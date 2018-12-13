// this class is used to store the matrices to draw objects
// the time value is used to determine when the object is no longer needed because it moves behind the frame
// the type value is used to identify what the object is, i.e, box or cone
class Transformation_Node
{
  constructor(matrix, time, type, bounding_box, parameters) 
    { 
        this.matrix = matrix; 
        this.t = time;
        this.next = null;
        this.pre = null;
        this.type = type;
        this.bounding_box = bounding_box;
        if (parameters != undefined)
          this.parameters = parameters;
        else this.parameters = {};
    }

  object_type()
  {
    return this.type;
  }
  
  transform()
  {
    return this.matrix;
  }

  time()
  {
    return this.t;
  }

  get_bounding_box()
  {
    return this.bounding_box;
  }
}

// this class is used to store a sequence of transformation nodes, and is similar to a queue in that
// the first item pushed onto the list will be the first item popped off the list
// it has an iterator method called next() that returns the next item in the list each time it is called
// the pop method is used to prevent the list from becoming too huge and is designed to remove items that 
// are behind the camera, which can be identified by examining their time value

// to iterate through all items, use 
//        for (var i = 0; i < this.list.length(); i++)
//          let temp = this.list.next();
//          if (some_condition)
//             list.pop()
class Matrix_List { 
    constructor() 
    { 
        this.head = null;
        this.tail = null;
        this.size = 0; 
        this.cur = null;
    }

    length()
    {
      return this.size;
    }

    next()
    {
      if (this.size == 0)
        return;
      let temp = this.cur;
      if (this.cur == this.tail)
        this.cur = this.head;
      else this.cur = this.cur.next;
      return temp;
    }

    get_current_node()
    {
      if (this.size == 0)
        return;
      return this.cur;
    }

    advance_node()
    {
      if (this.size == 0)
        return;
      if (this.cur == this.tail)
        this.cur = this.head;
      else this.cur = this.cur.next;
    }

    replace_node(element, time, type, bounding_box, parameters)
    {
      if (this.size == 0)
        return;
        var node = new Transformation_Node(element, time, type, bounding_box, parameters);
        if (this.cur != this.head)
        {
          node.pre = this.cur.pre;
          node.pre.next = node;
        }
        else this.head = node;
        if (this.cur != this.tail)
        {
          node.next = this.cur.next;
          node.next.pre = node;
        }
        else this.tail = node;
        this.cur = node;
    }
    reset_pointer()
    {
      this.cur = this.head;
    }

    push(element, time, type, bounding_box, parameters) 
    { 
     var node = new Transformation_Node(element, time, type, bounding_box, parameters); 
   
    if (this.size == 0)
    {
        this.head = node; 
        this.tail = node;
        this.cur = node;
    }
    else {
        node.pre = this.tail;
        this.tail.next = node;
        this.tail = node;
    } 
    this.size++; 
    }

    pop()
    {
      if (this.size == 0)
      {
        return;
      }
      if (this.size == 1)
      {
        this.head = null;
        this.tail = null;
        this.cur = null;
      }
      else
      {
        if (this.cur == this.head)
          this.cur = this.head.next;
        this.head = this.head.next;
        this.head.pre = null;
      }
      this.size--;
    }

    remove_current_node()
    {
      if (this.cur == this.head)
        this.pop();
        // pop() already decrements size
      else if (this.cur == this.tail) {
        this.tail = this.tail.pre;
        this.cur = this.head;
        this.size--;
      } else {
        this.cur.pre.next = this.cur.next;
        this.cur.next.pre = this.cur.pre;
        this.cur = this.cur.next;
        this.size--;
      }
    }

    delete(node)
    {
      if (node == this.head)
        this.pop();
        // pop() already decrements size
      else if (node == this.tail) {
        this.tail = this.tail.pre;
        node = this.head;
        this.size--;
      } else {
        node.pre.next = node.next;
        node.next.pre = node.pre;
        node = node.next;
        this.size--;
      }
    }
}


// Axis-aligned Bounding Box for rectangular boxes (main box and ground objects).
class Bounding_Box {
  //  center:         [x,y,z]
  //  manual_scale:   scale for OBJ file
  constructor(center, matrix_transform, width = 1, length = 1, height = 1, manual_scale = null) {
    this.center = center;
    this.matrix_transform = matrix_transform;
    this.width = width, this.length = length, this.height = height;
    this.minX = center[0] - width, this.maxX = center[0] + width;
    this.minY = center[1] - height, this.maxY = center[1] + height;
    this.minZ = center[2] - length, this.maxZ = center[2] + length;
    this.manual_scale = manual_scale;
  }

  get_top()
  {
    return this.maxY;
  }

  update_data(vecXYZ)
  {
    // Update bounding box coordinates
    this.minX = this.minX + vecXYZ[0], this.maxX = this.maxX + vecXYZ[0];
    this.minY = this.minY + vecXYZ[1], this.maxY = this.maxY + vecXYZ[1];
    this.minZ = this.minZ + vecXYZ[2], this.maxZ = this.maxZ + vecXYZ[2];

    // Update Center
    this.center = [this.center[0] + vecXYZ[0], this.center[1] + vecXYZ[1], this.center[2] + vecXYZ[2]];

    // Update the box's matrix transform.
    this.matrix_transform = this.matrix_transform.times(Mat4.translation(vecXYZ));
  }

  // Translates the bounding box if it will not overlap with any object in this.ground.
  //  vecXYZ:       The translation vector.
  //  matrix_list:  The list of ground objects (this.ground).
  //  object_type:  "main_cube" or "spike" or  "bomb"
  //  main_cube:    The Bounding_Box object of the main cube. Pass this in when translating
  //                the spikes/bombs.
  translate(vecXYZ, matrix_lists, object_type, main_cube, should_update_data = true) {
    // returns array of bools, first bool indicates collision detected, second indicates game should end

    let collision_detected = false;
    let game_should_end = false;
    // If we are translating the main cube, check if it will overlap with anything
    // in matrix_list before moving it. If it will, then don't translate.
    let hit_ground = false;
    if (object_type == "main_cube") {
      let newBounds = this.boundsIfTranslate(vecXYZ);
      for (var j = 0; j < matrix_lists.length; j++)
      {
        matrix_lists[j].reset_pointer();
        for (var i = 0; i < matrix_lists[j].length(); i++) { // check objects in each list for collisions
          let temp = matrix_lists[j].next();
          if (temp.object_type() == 'comet_fire')
            continue;
          let object_bounds = temp.get_bounding_box();
          if (temp.object_type() == 'ground' && object_bounds.maxZ < -10)
            break; // can skip the rest of this matrix list because the objects are far away
          if (this.wouldOverlap(object_bounds, newBounds))
          {
            if (temp.object_type() == 'ground')
            {
              vecXYZ[1] = temp.get_bounding_box().get_top() - this.minY;
              this.update_data(vecXYZ);
              hit_ground = true;
            }
            else return [true, true]; // something other than ground was hit, game over
          }
        }
      }
    }
    
    // Translate the bomb.
    if (object_type == "bomb") {
      let newBounds = this.boundsIfTranslate(vecXYZ);
      // Check if bomb collides with ground.
      for (var j = 0; j < matrix_lists.length; j++)
      {
        for (var i = 0; i < matrix_lists[j].length(); i++) {
          let temp = matrix_lists[j].next();
          if (this.wouldOverlap(temp.get_bounding_box(), newBounds))
          {
            if (temp.object_type() == 'ground')
            {
              vecXYZ[1] = temp.get_bounding_box().get_top() - this.minY;
              this.update_data(vecXYZ);
              collision_detected = true;
            }
          }
        }
        // Check if bomb collides with player.
        if (this.wouldOverlap(main_cube, newBounds))
        {
          game_should_end = true;
        }
        if (collision_detected || game_should_end) {
          return [collision_detected, game_should_end];
        }
      }
    }
  
    if (should_update_data)
      this.update_data(vecXYZ);
    return [hit_ground, false];
  }

  // Returns the new {minX, maxX, minY, maxY, minZ, maxZ} if we were to translate
  // the bounding box with vecXYZ (for collision detection). The return value is
  // an array with indices 0, ..., 5.
  boundsIfTranslate(vecXYZ) {
    return [
      this.minX + vecXYZ[0], this.maxX + vecXYZ[0],
      this.minY + vecXYZ[1], this.maxY + vecXYZ[1],
      this.minZ + vecXYZ[2], this.maxZ + vecXYZ[2]
    ];
  }

  // Check if this box overlaps with another box.
  checkOverlap(other_box) {
      return (this.minX <= other_box.maxX && this.maxX >= other_box.minX) &&
             (this.minY <= other_box.maxY && this.maxY >= other_box.minY) &&
             (this.minZ <= other_box.maxZ && this.maxZ >= other_box.minZ);
  };

    // Check if 2 Bounding_Box objects a and b overlap.
//   checkOverlap(a, b) {
//       return (a.minX <= b.maxX && a.maxX >= b.minX) &&
//              (a.minY <= b.maxY && a.maxY >= b.minY) &&
//              (a.minZ <= b.maxZ && a.maxZ >= b.minZ);
//   };

  // Check if this box would overlap with another box if its bounds were newBounds.
  wouldOverlap(other_box, newBounds) {
    let new_minX = newBounds[0], new_maxX = newBounds[1],
        new_minY = newBounds[2], new_maxY = newBounds[3],
        new_minZ = newBounds[4], new_maxZ = newBounds[5];
    
    return (new_minX < other_box.maxX && new_maxX > other_box.minX) &&
           (new_minY < other_box.maxY && new_maxY > other_box.minY) &&
           (new_minZ < other_box.maxZ && new_maxZ > other_box.minZ);
  }

  // Returns the box's matrix transform.
  get_transform() {
    if (this.manual_scale == null)  // Normal case
      return this.matrix_transform.times(Mat4.scale([this.width, this.height, this.length]));  // Must scale at the end.
    else { // Special case: scaling obj file shape but not the bounding box itself.
      let x_scale = this.manual_scale[0];
      let y_scale = this.manual_scale[1];
      let z_scale = this.manual_scale[2];
      return this.matrix_transform.times(Mat4.scale([x_scale, y_scale, z_scale]));  // Must scale at the end.
    }
  }

  // Returns the center of the box.
  get_center() {
    return this.center;
  }
}

function sound(src, volume = 1.0) {
  this.sound = document.createElement("audio");
  this.sound.src = src;
  this.sound.setAttribute("preload", "none");
  this.sound.setAttribute("controls", "none");
  this.sound.volume = volume;
  this.sound.style.display = "none";
  document.body.appendChild(this.sound);
  this.play = function(){
//     var isPlaying = this.sound.currentTime > 0 && !this.sound.paused
//                     && !this.sound.ended && this.sound.readyState > 2;

//     if (!isPlaying) {
      this.sound.load();
      this.sound.play();
//     }

  }
  this.stop = function(){
    this.sound.pause();
    this.sound.currentTime = 0;
  }
  this.load = function(){
    this.sound.load();
  }
  this.set_volume = function(volume){
    this.sound.setAttribute("volume", volume);
  }
}

window.Scene = window.classes.Scene =
class Scene extends Scene_Component
  { constructor( context, control_box )     // The scene begins by requesting the camera, shapes, and materials it will need.
      { super(   context, control_box );    // First, include a secondary Scene that provides movement controls:
        if( !context.globals.has_controls   )
          context.register_scene_component( new Movement_Controls( context, control_box.parentElement.insertCell() ) );

        const r = context.width/context.height;
        context.globals.graphics_state.camera_transform = Mat4.translation([ 0, -7, -25 ]);  // Locate the camera here (inverted matrix).
        context.globals.graphics_state.projection_transform = Mat4.perspective( Math.PI/4, r, .1, 1000 );

        const shapes = { 'background': new Cube(),
                         'box': new Cube(),
                         'main_cube': new Cube(),
                         'long_box': new Cube(),
                         'spike': new Spike(8, 8),
                         'sphere': new Subdivision_Sphere(4),
                         'ring': new Torus(12, 12),
                         'ship': new StarWars(),


                         'fire': new Fire(500),
                         'explosion': new Explosion(1200, 8), //parameters: (count, lifeTimeOfEachParticle)
                         'big_explosion' : new Explosion(2000, 8),
                         'bomb': new Shape_From_File("assets/Bomb.obj"),
                         'ufo': new Shape_From_File("assets/UFO.obj"),
                         'wormhole': new Wormhole(750,8,6.0),
                         'big_wormhole': new Wormhole(750, 8, 8.0)

                       }
        shapes.box.texture_coords = shapes.box.texture_coords.map( (x, i) => {if (i == 16 || i == 17 || i == 18 || i == 19) return Vec.of(x[0]*=3, x[1]*=.5); // adjust front mapping
                                                                              else if (i == 4 || i == 5 || i == 6 || i == 7) return Vec.of(x[0]*=1, x[1]*=1); // adjust top mapping
                                                                              else return Vec.of(x[0], x[1]);});
        shapes.long_box.texture_coords = shapes.long_box.texture_coords.map( x => Vec.of(x[0]*=1, x[1]*=6));
        this.submit_shapes( context, shapes );

        // calculate TBN matrix for cube normal maps
        let tbn_vectors = this.make_tbn_vectors();

        // Make some Material objects available to you:
        this.materials = 
        {
          basic: context.get_instance( Phong_Shader ).material( Color.of( 0,0,0,1 ), {ambient:1, specularity:0}),
          background1: context.get_instance( Phong_Shader ).material( Color.of( 0,0,0,1 ), { ambient:1, texture: context.get_instance( "assets/sky.jpg", true ) }),
          background2: context.get_instance( Phong_Shader ).material( Color.of( 0,0,0,1 ), { ambient:1, texture: context.get_instance( "assets/space.jpg", true ) }),
          spike: context.get_instance( Bump_Shader ).material( Color.of( 1,1,1, 1 ), { ambient: .2, diffusivity: 1, specularity: 1, tangent: tbn_vectors[0], bitangent: tbn_vectors[1], texture: context.get_instance( "assets/test.jpg", true )} ),
          ground1: context.get_instance( Bump_Shader ).material( Color.of( .55,.27,.07, 1 ), { ambient: .3, diffusivity: 1  , specularity: .5, 
                                                                                           texture: context.get_instance( "assets/ground_normals.jpg", true ),
                                                                                           tangent: tbn_vectors[0], bitangent: tbn_vectors[1]} ),
          ground2: context.get_instance( Bump_Shader ).material( Color.of( 0,0,.7, 1 ), { ambient: .3, diffusivity: 1  , specularity: 1, 
                                                                                           texture: context.get_instance( "assets/g2.jpg", true ),
                                                                                           tangent: tbn_vectors[0], bitangent: tbn_vectors[1]} ),
          fun_texture1: context.get_instance( Phong_Shader ).material( Color.of( 0,0,0,1 ), { ambient:1, diffusivity: 1, specularity: 0, texture: context.get_instance( "assets/top_secret.png", true ) }),
          fun_texture2: context.get_instance( Phong_Shader ).material( Color.of( 0,0,0,1 ), { ambient:1, diffusivity: 1, specularity: 0, texture: context.get_instance( "assets/top_secret.png", true ) }),
          ring_planet: context.get_instance( Bump_Shader ).material( Color.of( .7, 0, 0, 1), {ambient: .5, tangent: tbn_vectors[0], bitangent: tbn_vectors[1], texture: context.get_instance( "assets/planet_normals.jpg", true )}),
          ring: context.get_instance( Ring_Shader ).material( Color.of(.5,0,.5,1), {ambient: .5}),
          asteroid: context.get_instance( Bump_Shader ).material(Color.of(.8,.67,.67,1), {ambient:1, specularity:1, texture: context.get_instance( "assets/asteroid_normal.jpg", true ), tangent: tbn_vectors[0], bitangent: tbn_vectors[1]}),
          comet: context.get_instance( Bump_Shader ).material( Color.of( .7, .3, .7, 1), {ambient: .5, tangent: tbn_vectors[0], bitangent: tbn_vectors[1], texture: context.get_instance( "assets/asteroid_normal.jpg", true )}),
          ufo: context.get_instance( Phong_Shader )  .material( Color.of( 0,0,0,1 ), { diffusivity: 0.5, ambient: 0.8, texture: context.get_instance("assets/ufo_texture.png", true) } ),
          //Particle Materials:
          fireParticle: context.get_instance( Particle_Shader ).material( Color.of(0.8, 0.25, 0.25, 1), {texture: context.get_instance("assets/fire-texture-atlas.jpg", true) }), //red flames
          comet_fire: context.get_instance( Particle_Shader ).material( Color.of(0.8, 0, 0.8, 1), {texture: context.get_instance("assets/fire-texture-atlas.jpg", true) }),
          bomb: context.get_instance( Phong_Shader )  .material( Color.of( 0,0,0,1 ), { ambient: 0.5, texture: context.get_instance("assets/bomb_texture.png", true)} ),
          wormholeParticle: context.get_instance( Wormhole_Shader ).material(Color.of(0.8,0.25,0.25,1), {texture: context.get_instance("assets/fire-texture-atlas.jpg", true) })
        };

        // Game Title and Instructions
        this.title_instructions = document.getElementById('title_instructions');

        // Initialize Music / Sounds
            // Note: bgm does not use the Javascript sound class. It has an HTML element in index.html.
        this.bgm1 = document.getElementById('bgm1');
        this.bgm1.volume = 0.4;
        this.bgm2 = document.getElementById('bgm2');
        this.bgm2.volume = 0.4;
        
        this.jumping_sound = new sound("audio/sounds/jump.mp3", 0.1);
        this.landing_sound = new sound("audio/sounds/thud.mp3", 0.4);
        this.cheering_sound = new sound("audio/sounds/crowd_cheering.mp3", 0.5);
        this.bomb_siren = new sound("audio/sounds/bomb_siren.mp3", 0.2);
        this.explosion_sound = new sound("audio/sounds/explosion.mp3", 0.5);

        // Static control intialization
        this.ground_timer = 1.5; // this is used to control how often ground forms
        this.bomb_timer = 0.9; // this is used to control how often bomb forms
        this.adjustment = 1; // how much the box moves per user input
        this.score = document.getElementById("score");
        this.high_score = document.getElementById("high_score");
        this.high_score_val = 0;
        this.special_mode_display = document.getElementById("special_mode_display");
        this.special_mode_display_tag = document.getElementById("special_mode_display_tag");
        this.pause_display = document.getElementById("pause_display");
        this.stage_display = document.getElementById("stage_display");
        this.game_over_msg = document.getElementById("game_over_msg");
        this.paused_time = 0; // the amount of time that was the game was paused after bomber entry
        this.invincible = false;
        this.spectator = false;

        // Game stages and transition variables
        this.second_stage_start_time = 15;  // Space + Bomber
        this.bomber_entry_time = this.second_stage_start_time;
        this.third_stage_start_time = 35;   // Space + Bomber + Asteroids
        this.fourth_stage_start_time = 55;  // Space + Bomber + Asteroids + Tons of bombs

        // these control the jumping height, falling speed, etc
        // max jump height is: (jump_velocity**2)/gravity_constant
        // it takes jump_velocity/gravity_constant seconds to reach max jump height
        // jump travels distance: movement_speed * 2 * jump_velocity/gravity_constant if end height is same as start height
        this.gravity_constant = 20;
        this.jump_velocity = 12.5;
        this.movement_speed = .2;
        this.bomb_speed = .6;

        // provide a bunch of colors
        this.all_colors = [ Color.of(0.25, 0.25, 8.25, 1.0)];

        // Game initialization
        this.ready_to_start = true;
        this.make_stage1();

        //disable camera focus on player
        this.disableCameraFocus = false;
      }
    make_control_panel()
    {
        this.key_triggered_button( "Restart", [ "r" ], () => {if (this.game_over) {this.restart = true; this.ready_to_start = true;}});
        this.key_triggered_button( "Start", [ "b" ], () => {if (this.ready_to_start) {this.start = true; this.title_instructions.style.visibility = 'hidden'; this.bgm1.play(); this.ready_to_start = false;}}); // this starts the game
        this.key_triggered_button( "Pause", [ "p" ], () => {this.pause = !this.pause;} );
        this.key_triggered_button( "Continue", [ "c" ], () => {if(this.start && !this.game_over) this.continue = !this.continue;} );
        this.key_triggered_button( "Left", [ "a" ], () => {if (this.start && !this.game_over && !this.pause) this.moving_left = true}, undefined, () => {this.moving_left = false} ); // movement controls
        this.key_triggered_button( "Right", [ "d" ], () => {if (this.start && !this.game_over && !this.pause) this.moving_right = true}, undefined, () => {this.moving_right = false} );
        this.key_triggered_button( "Fast Falling", [ "s" ], () => {if (this.jumping && this.start && !this.game_over && !this.pause) this.fast_fall = true}, undefined, () => {this.fast_fall = false} );
        this.key_triggered_button( "Jump", [ " " ], () => {
          if (this.start && !this.game_over && this.can_jump && !this.pause)
          {
            if (this.jumping)
              this.can_jump = false;  // only allow 1 more jump after the first one
            
            this.jumping = true;
            this.update_jump_time = true;
            this.jumping_sound.play();
          }
        } );
        this.key_triggered_button( "Invincibility", [ "t" ], () => {this.invincible = !this.invincible;} );
        this.key_triggered_button( "Spectator Mode", [ "y" ], () => {
          // If turning off spectator mode, the cube should just fall and die.
          if (this.spectator) {
            this.invincible = false;
            this.spectator = false;
          } else { // Turn on invincibility with spectator mode.
            this.invincible = true;
            this.spectator = true;
          }
        } );
        this.key_triggered_button( "Free Camera Focus", [ "0" ], () => {this.disableCameraFocus = !this.disableCameraFocus;} );
      }
    make_tbn_vectors()
    {
        let pos1 = Vec.of(-1.0,  1.0, 0.0);
        let pos2 = Vec.of(-1.0, -1.0, 0.0);
        let pos3 = Vec.of( 1.0, -1.0, 0.0);
        let pos4 = Vec.of( 1.0,  1.0, 0.0);
        // texture coordinates
        let uv1 = Vec.of(0.0, 1.0);
        let uv2 = Vec.of(0.0, 0.0);
        let uv3 = Vec.of(1.0, 0.0);
        let uv4 = Vec.of(1.0, 1.0);
        // normal vector
        let nm = Vec.of(0.0, 0.0, 1.0);

        let edge1 = pos2.minus( pos1 );
        let edge2 = pos3.minus( pos1 );
        let deltaUV1 = uv2.minus( uv1 );
        let deltaUV2 = uv3.minus( uv1 );

        let f = 1.0 / (deltaUV1[0] * deltaUV2[1] - deltaUV2[0] * deltaUV1[1]);
        let tangent1 = Vec.of(0,0,0);
        tangent1[0] = f * (deltaUV2[1] * edge1[0] - deltaUV1[1] * edge2[0]);
        tangent1[1] = f * (deltaUV2[1] * edge1[1] - deltaUV1[1] * edge2[1]);
        tangent1[2] = f * (deltaUV2[1] * edge1[2] - deltaUV1[1] * edge2[2]);
        let bitangent1 = Vec.of(0,0,0);
        bitangent1[0] = f * (-deltaUV2[0] * edge1[0] + deltaUV1[0] * edge2[0]);
        bitangent1[1] = f * (-deltaUV2[0] * edge1[1] + deltaUV1[0] * edge2[1]);
        bitangent1[2] = f * (-deltaUV2[0] * edge1[2] + deltaUV1[0] * edge2[2]);
        return [tangent1, bitangent1];
    }
    make_stage1()
    {
      // Show title and game instructions
      this.title_instructions.style.visibility = 'visible';

      this.ground = new Matrix_List(); // all of the ground transformations ar shaderse here
      this.fire_list = new Matrix_List();
      let width = 8, height = 1, length = 100;
      let ground_center = [0,0,0];
      let ground_transform = Mat4.identity();
      let ground_bounding_box = new Bounding_Box(ground_center, ground_transform, width, length, height);
      ground_bounding_box.translate([0,0,-80]);

      this.ground.push(ground_transform, 0, 'ground', ground_bounding_box, {object: 'long_box'}); // initial starting platform

      // Put a spike on the first platform, for purposes of easily demo-ing what happens
      // if you were to hit one.
      this.spawn_spike_triplet(0,0,-60,0);
      let i = 0;
      let j = 0;
      while(i<180)
      {
        let p = {color:this.all_colors[j%this.all_colors.length]};
        this.spawn_ground_obstacle(-7, -.6, -i, 0, 'start_game_fire', p);
        this.spawn_ground_obstacle(7, -.6, -i, 0, 'start_game_fire', p);
        i+=9;
        j+=1;
      }

      // game state controls
      this.start = false; // user says when to start the game
      this.game_over = false;  // made true when cube dies
      this.start_time = 0; // when the game starts
      this.final_score = -1;
      this.restart = false;
      this.fall_time = 0;
      this.jump_time = 0;
      this.update_jump_time = true;
      this.current_scene = "earth"; // changes to "space"
      this.current_stage = 1;       // 1 through 4
      this.last_time = 0;  // the last time a ground was formed
      this.last_time_bomb = 0;  // the last time a bomb was formed
      this.pause = false;  // pauses movement of all objects
      this.incremental_time = 0;
      this.incremental_time2 = 0;
      this.played_bomber_intro = false;  // set to true when bomber comes in
      this.playing_bomber_intro = false; // need this for fixing camera bug
      this.continue = false; // used to resume the game after a transitioning scene plays
      this.paused_time = 0;
      this.played_bomb_siren = false;
      this.played_explosion_sound = false;
      this.bomb_timer = 0.9;
      this.played_cheering_sound1 = false;
      this.played_cheering_sound2 = false;

      // Cube initialization
      this.temp_box_transform = Mat4.identity();
      let box_center = [0,0,0];
      this.box = new Bounding_Box(box_center, this.temp_box_transform);
      this.box.translate([0,8,0], [this.ground, this.fire_list], "main_cube");
      this.jumping = false;
      this.can_jump = true;
      this.falling = false;
      this.moving_left = false;
      this.moving_right = false;
      this.fast_fall = false;
      
      // special event controls
      this.space_stage_began = false;
      this.special_objects = new Matrix_List();
      this.asteroid_begin_time = this.third_stage_start_time;
      this.asteroid_event_end_time = 10000 + this.asteroid_begin_time; 
      this.spawn_asteroid_time = 0;
      this.delay_asteroid_spawn = 3;
      this.spawn_comet_time = 0;
      this.delay_comet_spawn = 3;

      // Matrix_List for bombs
      this.bombs = new Matrix_List();

      // list for explosions
      this.explosions = new Matrix_List();
      this.asteroid_explosion_time = 1;
      this.final_explosion_time = .7;

      // Lights
        this.lights = [ new Light( Vec.of( 0,5,-70,1 ), Color.of( 1, 1, 0, 1 ), 100000 ),
         new Light( Vec.of( 0,5,10,1 ), Color.of( 1, 1, 0, 1 ), 100000 )];

      // Reset audio
      this.bgm1.pause(); this.bgm2.pause(); this.bgm1.currentTime = 0; this.bgm2.currentTime = 0;
    }
    update_box_pos(t)
    {
      if (this.spectator) // Spectator Mode
        return;

      // The box is continuously falling in order to detect if it is on the ground or not
      if (this.jumping) {
        if (this.update_jump_time)  // true when the jump button is pressed and valid
        {
          this.jump_time = t; // this jump time keeps track of the point in time at which the player jumps
          this.update_jump_time = false;
          if (!this.can_jump) {
            // This will execute when we double jump.
            // Update the box's position so that the second jump starts at the right position.
            this.box.translate([0,this.delta_y,0], [this.ground, this.fire_list], "main_cube", this.box, true);
          }
          if (this.falling) {
            // This will execute when we jump while free falling after walking off a platform.
            // Update the box's position so that the jump starts at the right position.
            this.box.translate([0,this.delta_y,0], [this.ground, this.fire_list], "main_cube", this.box, true);
            this.falling = false;
          }
        }

        let delta_t = t - this.jump_time;
        this.delta_y = this.jump_velocity*delta_t - .5*this.gravity_constant*(delta_t**2); // physics calculation
        let temp = [];
        if((temp = this.box.translate([0,this.delta_y,0], [this.ground, this.fire_list], "main_cube", this.box, false))[0]) // if true, landed on ground
        {
          if (temp[1] && !this.invincible)
          {
            this.game_over = true;
            return;
          }
          this.fast_fall = false;
          this.jump_time = t;
          this.fall_time = t; // since we are always falling, need to update this here
          this.temp_box_transform = this.box.get_transform(); // these transforms are now aligned
          this.jumping = false;
          this.can_jump = true;
          this.landing_sound.play();
        }
        else this.temp_box_transform = this.box.get_transform().times(Mat4.translation([0,this.delta_y,0])); // move the box through space   
      } 
      else {  // not jumping
        let delta_t = t - this.fall_time; // falling through space
        this.delta_y = -.5*this.gravity_constant*(delta_t**2);
        let temp = [];
        if((temp = this.box.translate([0,this.delta_y,0], [this.ground, this.fire_list], "main_cube", this.box, false))[0])  // touching ground
        {
          if (temp[1] && !this.invincible)
          {
            this.game_over = true;
            return;
          }
          this.fast_fall = false;
          this.fall_time = t; // continue to update as long as we are on the ground
          this.temp_box_transform = this.box.get_transform();
        }
        else {
          this.temp_box_transform = this.box.get_transform().times(Mat4.translation([0,this.delta_y,0]));
          this.falling = true;  // the cube isn't jumping, yet it's still falling through space
        }
      }

      // If the cube fell for too long, assume that it died.
      if (!this.invincible && ((this.jumping && t - this.jump_time > 3) || (!this.jumping && t - this.fall_time > 2))) {
        this.game_over = true;
      }

      // Move the cube left or right
      if (this.start && this.moving_left)
        this.box.translate([-0.25,0,0]);
      if (this.start && this.moving_right)
        this.box.translate([0.25,0,0]);
      if (this.start && this.fast_fall)
        this.box.translate([0,-0.25,0]);
      for (let k = 0; k < this.lights.length; k++)
      {
        this.lights[k].position[0] = this.temp_box_transform[0][3]; // move x
        this.lights[k].position[1] = this.temp_box_transform[1][3]; // move y
      }

    }
    spawn_ground_obstacle(x, y, z, t, object, parameters)
    {
      let transform = Mat4.identity();
      let center = [0,0,0]; 
      let bounding_box = new Bounding_Box(center, transform, 1, 1, 1);
      bounding_box.translate([x, y+2, z]);
      if (object == 'spike')
        this.ground.push(transform, t, object, bounding_box);
      else if (object == 'fire')
        this.fire_list.push(transform, t, object, bounding_box);
      else if (object == 'end_game_fire')
        this.fire_list.push(transform, t, object, bounding_box);
      else if (object == 'start_game_fire')
        this.fire_list.push(transform, t, object, bounding_box, parameters);
      else if (object == 'asteroid_explosion')
        this.explosions.push(transform, t, object, bounding_box, {expiration:(parameters.t2+this.asteroid_explosion_time), scale:parameters.r, rotate_left:parameters.rotate});
      else if (object == 'end_game_explosion')
        this.explosions.push(transform, t, object, bounding_box, {expiration:(t+this.final_explosion_time)});
    }
    spawn_spike_triplet(x, y, z, t)
    {
      this.spawn_ground_obstacle(x-2,y,z,t, 'spike');
      this.spawn_ground_obstacle(x,y,z,t, 'spike');
      this.spawn_ground_obstacle(x+2,y,z,t, 'spike');
    }
    spawn_ground(t)
    {
      if (t - this.ground_timer > this.last_time)
      {
        this.last_time = t;
        let width = Math.random() * 7 + 8;  // 8 to 15 
        let length = Math.random() * 20 + 10; // 10 to 30
        let area = width * length; // used to increase the chance of spikes for larger platforms
        let max_area = 15*30;
        let x = Math.random() * 30 - 15 + this.temp_box_transform[0][3];    // -15 to 15 from current x coordinate
        let y = Math.random() * 3 -1.5 + this.temp_box_transform[1][3]; // 1.5 above/below current positions
                                                                         // note: this could result in a jump of 3 units
        let z = -150;
        let height = 1;
        let ground_transform = Mat4.identity().times(Mat4.translation([x,y,z]));
        let ground_center = [x,y,z];
        this.ground.push(ground_transform, t, 'ground', new Bounding_Box(ground_center, ground_transform, width, length, height)); // this creates the next ground segment of random size and location

        // this creates spikes on top of ground segments
        let spike_selector = Math.random();
        let count = 0;
        let minX = x - width + 3; // this determines the possible positions for the spikes on each platform
        let maxX = x + width - 3;
        let minZ = z - length + 6;
        let maxZ = z + length - 6;
        let z_array = [];
        while (spike_selector <= (1.1 - 15*count/area) * area/max_area && count < length / 5) // chance depends on platform size and decreases for consecutive spikes
        {
          let x_pos = Math.random() * (maxX - minX) + minX;
          let z_pos = Math.random() * (maxZ - minZ) + minZ;
          let spawn = true;
          for (let iter = 0; iter < z_array.length; iter++) // this avoids overlapping spikes
          {
            if ((z_pos - 2 < z_array[iter] && z_pos > z_array[iter]) || (z_pos + 2 > z_array[iter] && z_pos < z_array[iter]))
            {
              spawn = false;
              break;
            }
          }
          if (spawn)
          {
            this.spawn_spike_triplet(x_pos,y,z_pos,t);
            z_array.push(z_pos);
          }
          spike_selector = Math.random();
          count++;
        }
      }
    }
    move_box(graphics_state, t)
      {
        if (this.playing_bomber_intro)
          return;
        if (!this.pause)
          this.update_box_pos(t);
        let model_transform_camera = this.temp_box_transform; // point the camera at the moving cube
        model_transform_camera = model_transform_camera.times( Mat4.translation([0,4,25]) );
        model_transform_camera = Mat4.inverse( model_transform_camera );
        model_transform_camera = model_transform_camera.map( (x,i) => Vec.from( graphics_state.camera_transform[i] ).mix( x, 0.1 ) );
        if (!this.disableCameraFocus)
        {
          graphics_state.camera_transform = model_transform_camera;
        }
        graphics_state.lights = this.lights;        // Use the lights stored in this.lights.
      }
    end_game(graphics_state, t)
    {
      this.pause = true;
      if (!this.played_explosion_sound) {
        this.explosion_sound.play();
        this.played_explosion_sound = true;
      }
      if (this.final_score == -1)
      {
        this.final_score = 10*t;
        this.spawn_ground_obstacle(this.temp_box_transform[0][3],this.temp_box_transform[1][3]-2,this.temp_box_transform[2][3], t,'end_game_explosion');
        this.spawn_ground_obstacle(this.temp_box_transform[0][3],this.temp_box_transform[1][3]-2,this.temp_box_transform[2][3], t,'end_game_fire');
      }
      this.update_score(this.final_score);
    }
    spawn_asteroids(t, num_y, base_y, range_y, num_z, base_z, range_z, object)
    {
      let var_y = range_y/num_y;
      let var_z = -range_z/num_z;
      let transform = Mat4.translation([-300+this.temp_box_transform[0][3],base_y+this.temp_box_transform[1][3],base_z]);
      for (let iter1 = 0; iter1 < num_y; iter1++)
      {
        transform = transform.times(Mat4.translation([0, var_y, range_z]));
        for (let iter2 = 0; iter2 < num_z; iter2++)
        {
          transform = transform.times(Mat4.translation([0,0,var_z]));
          let selector = Math.floor(Math.random() * 4); // 0 to 3
          if (object == 'comet' || selector == 0) // 25 percent chance
          {
            let x_displace = Math.random() * 50 - 25;
            let y_displace = var_y * (Math.random() * .5- .25); // randomize location
            let z_displace = var_z * (Math.random() * .5 - .25);
            let s_x = Math.random() * 6 - 3;
            let s_y = Math.random() * 2 - 1; // random speed
            let s_z = Math.random() * 4 - 2;
            let r = Math.random() * 2 + .5; // random radius
            let rotate_speed = (Math.random() * 2 + 1)/4;
            if (object == 'asteroid')
              this.special_objects.push(transform.times(Mat4.translation([x_displace, y_displace, z_displace])), t, 'asteroid', undefined, {movement:[30+s_x,-10+s_y,20+s_z], radius:r, impact:false, impact_time:0, rotate_speed:rotate_speed});
            else if (object == 'comet')
            {
              r *= 2;
              let move_vec = Vec.of(40+s_x,-5+s_y,15+s_z);
              move_vec.normalize();
              this.fire_list.push(transform.times(Mat4.translation([x_displace-.5*r*move_vec[0], y_displace-.5*r*move_vec[1], r/2+z_displace-.5*r*move_vec[2]])), t, 'comet_fire', undefined, {movement:[40+s_x,-5+s_y,15+s_z], post_trans:Mat4.rotation(Math.PI/2, Vec.of(0,0,1)).times(Mat4.scale([r,r,r]))});
              this.special_objects.push(transform.times(Mat4.translation([x_displace, y_displace, z_displace])), t, 'comet', undefined, {movement:[40+s_x,-5+s_y,15+s_z], radius:r, rotate_speed:rotate_speed});
            }
          }
        }
      }
    }
    draw_special_objects(graphics_state, t)
    {
      if (t > this.second_stage_start_time) // special event
      {
        if (!this.space_stage_began)
        {
          this.space_stage_began = true;
          this.special_objects.push(Mat4.translation([50+this.temp_box_transform[0][3],50+this.temp_box_transform[1][3],-300]), t, 'ring_planet');
        }
        if (t > this.asteroid_begin_time && t < this.asteroid_event_end_time && t - this.spawn_asteroid_time > this.delay_asteroid_spawn)
        {
          this.spawn_asteroids(t, 4, 50, 100, 12, -400, 300, 'asteroid');
          this.spawn_asteroid_time = t;
        }
      }
      if (t > this.second_stage_start_time && t - this.spawn_comet_time > this.delay_comet_spawn)
      {
        this.spawn_asteroids(t, 1, 70, 20, 2, -250, 125, 'comet');
        this.spawn_comet_time = t;
      }
      this.special_objects.reset_pointer();
      for (let iter = 0; iter < this.special_objects.length(); iter++)
      {
        let temp = this.special_objects.get_current_node();
        let model = temp.transform();
        let delta_t = t - temp.time();
        if (temp.object_type() == 'ring_planet' && this.current_scene == "space")
        {
          model = model.times(Mat4.translation([-3*delta_t,0,8*delta_t])).times(Mat4.rotation(1/3*Math.PI*delta_t, Vec.of(1,1,0)));;
          if (model[2][3] > 100)
            this.special_objects.remove_current_node();
          else
          {
            this.shapes.sphere.draw(graphics_state, model.times(Mat4.scale([5,5,5])), this.materials.ring_planet);
            this.shapes.ring.draw(graphics_state, model.times(Mat4.scale([5,5,1/10])), this.materials.ring);
            this.special_objects.advance_node();
          }
        }
        else if (temp.object_type() == 'asteroid' || temp.object_type() == 'comet')
        {
          let move_x = temp.parameters.movement[0];
          let move_y = temp.parameters.movement[1];
          let move_z = temp.parameters.movement[2];
          let radius = temp.parameters.radius;
          let rotate_speed = temp.parameters.rotate_speed;
          model = model.times(Mat4.translation([move_x*delta_t,move_y*delta_t,move_z*delta_t]));
          if (model[2][3] > 20 || model[0][3] > 200)
            this.special_objects.remove_current_node();
          else
          {
            if (temp.object_type() == 'asteroid')
            {
              this.detect_asteroid_collisions(temp, model, t, radius, move_x, move_y, move_z, delta_t);
              model = model.times(Mat4.rotation(-rotate_speed*Math.PI*delta_t, Vec.of(1,0,1)));
              this.shapes.sphere.draw(graphics_state, model.times(Mat4.scale([radius,radius,radius])), this.materials.asteroid);
            }
            else if (temp.object_type() == 'comet')
            {
              model = model.times(Mat4.rotation(-rotate_speed*Math.PI*delta_t, Vec.of(0,1,1)))
              this.shapes.sphere.draw(graphics_state, model.times(Mat4.scale([radius,radius,radius])), this.materials.comet);
            }
            
            this.special_objects.advance_node();
          }
        }
      } 
    }
    check_intersection(coord, bound)
    {
      return ((coord[0] <= bound.maxX && coord[0] >= bound.minX) &&
             (coord[1] <= bound.maxY && coord[1] >= bound.minY) &&
             (coord[2] <= bound.maxZ && coord[2] >= bound.minZ));
    }
    check_bounds(bound, minY, maxY, minX, maxX, minZ, maxZ)
    {
      return (minX <= bound.maxX && maxX >= bound.minX) &&
             (minY <= bound.maxY && maxY >= bound.minY) &&
             (minZ <= bound.maxZ && maxZ >= bound.minZ);
    }
    detect_asteroid_collisions(node, matrix, t, radius, move_x, move_y, move_z, delta_t)
    {
      if (matrix[0][3] < this.temp_box_transform[0][3] - 40 || matrix[0][3] > this.temp_box_transform[0][3] + 40 || matrix[2][3] > 10) // reduce computations by limiting number of checks needed
        return false; // collision not possible

      for (var i = 0; i < this.ground.length()+1; i++) {
        let ground_matrix = undefined;
        let bound = undefined;
        let temp = undefined;
        let bound_scalar = 2; // increases bounding sphere volume for detection collision with ground
        if ( i == 0 ) // the first check is always against the main cube
        {
          if (matrix[0][3] < this.temp_box_transform[0][3] - 5 && matrix[0][3] > this.temp_box_transform[0][3] + 5)
            continue;
          ground_matrix = this.temp_box_transform;
          bound = this.box;
          bound_scalar = 1;
        }
        else
        {
          temp = this.ground.next();
          if (temp.object_type() == 'spike') // cannot collide with spike
            continue;
          bound = temp.get_bounding_box();
          ground_matrix = bound.get_transform();
        }
        let direction = Vec.of(ground_matrix[0][3], ground_matrix[1][3], 0).minus(Vec.of(matrix[0][3], matrix[1][3], 0));
        direction.normalize();                
        let alt_direction = direction.times(bound_scalar*radius); // find the closest point on sphere to center of box
        let center = Vec.of(matrix[0][3], matrix[1][3], matrix[2][3]);
        let coord = center.plus(alt_direction);
        let max_coord = center.plus(Vec.of(radius,radius,radius)); // form a bounding box to prevent clipping
        let min_coord = center.plus(Vec.of(-radius,-radius,-radius));
        if ((t - node.parameters.impact_time > .75) && // this prevents asteroids from colliding with the same object too many times
            (this.check_intersection(coord, bound) ||
             this.check_bounds(bound, min_coord[1], max_coord[1], min_coord[0], max_coord[0], min_coord[2], max_coord[2])))
           { 
             // check if asteroid hits cube
             if ( i == 0  && !this.invincible)
             {
              this.game_over = true;
              return true;
             }
             else
             { 
               let x = matrix[0][3];
               if (x < bound.minX + 1)
                 x = bound.minX + 1;
               else if ( x > bound.maxX - 1)
                 x = bound.maxX - 1;
               let z = matrix[2][3];
               if (z < bound.minZ + 1)
                 z = bound.minzZ + 1;
               else if ( z > bound.maxZ - 1)
                 z = bound.maxZ - 1;
               let y = bound.maxY-1.4;
               let rotate_left = false;
               if (direction[0] > .994) // objects that hit the left side of platform should bounce left
               {
                  this.special_objects.replace_node(matrix, t, node.object_type(), node.get_bounding_box(), {movement:[-Math.max(Math.abs(move_x)/3, 5),move_y,move_z ], radius:radius, impact:true, impact_time:t, rotate_speed:node.parameters.rotate_speed});
                  x = bound.minX+.4;
                  y = bound.minY+1;
                  rotate_left = true;
               }
               else if (direction[1] > 0) // hit the bottom of the ground after bouncing
               {
                 this.special_objects.replace_node(matrix, t, node.object_type(), node.get_bounding_box(), {movement:[Math.max(move_x/2, 8),-Math.max(Math.abs(move_y)/2, 3),move_z ], radius:radius, impact:true, impact_time:t, rotate_speed:node.parameters.rotate_speed});
                 node.parameters.impact = true; // prevent explosion
               }
               else
               {
                  this.special_objects.replace_node(matrix, t, node.object_type(), node.get_bounding_box(), {movement:[Math.max(move_x/2, 8),Math.max(Math.abs(move_y)/2, 3),move_z ], radius:radius, impact:true, impact_time:t, rotate_speed:node.parameters.rotate_speed});
                  // spawn fire
                  if (node.parameters.impact == false && temp != undefined)
                  { // this uses some fudging to account for the ground accelerating towards the player
                    this.spawn_ground_obstacle(x,y,z, temp.time(),'fire');
                  }
               }
               if (node.parameters.impact == false && temp != undefined)
                  this.spawn_ground_obstacle(x,y,z, temp.time(),'asteroid_explosion',{t2:t, r:10*radius, rotate:rotate_left}); // always draw explosion
               return true;
             }
           }
      }
      return false;
    }
    draw_background(graphics_state, t)
    {
      // Draw a giant, textured, flattened cube for our background image.
      if (this.current_scene == "earth") {  // On Earth
        this.shapes.background.draw(graphics_state, Mat4.identity()
                                                        .times(Mat4.translation([0,0,-320]))
                                                        .times(Mat4.scale([400,400,1])), this.materials.background1);
      } else {  // In Space
        this.shapes.background.draw(graphics_state, Mat4.identity()
                                                        .times(Mat4.translation([0,0,-320]))
                                                        .times(Mat4.scale([400,400,1])), this.materials.background2);
        let model = Mat4.identity();
        model = model.times(Mat4.translation([30,30,-300]));
        model = model.times(Mat4.scale([2.5,2.5,2.5]));
        this.shapes.sphere.draw(graphics_state, model.times(Mat4.scale([1.5,1.5,1.5])), this.materials.basic);
        this.shapes.wormhole.draw(graphics_state, model.times(Mat4.scale([1,1,.5])).times(Mat4.rotation(Math.PI/20, [0,0,1])), this.materials.wormholeParticle.override({color: Color.of(0.25, 0.25, 8.25, 1.0), lifetimeFraction: 5}));
        this.shapes.big_wormhole.draw(graphics_state, model.times(Mat4.scale([1,1,.5])).times(Mat4.rotation(Math.PI/5, [0,0,1])), this.materials.wormholeParticle.override({color: Color.of(0.25, 0.25, 8.25, 1.0), lifetimeFraction: 5}));

        let model2 = Mat4.translation([-160, 60, -300]);
        model2 = model2.times(Mat4.scale([2,2,2]));
        this.shapes.sphere.draw(graphics_state, model2.times(Mat4.scale([1.5,1.5,1.5])), this.materials.basic);
        this.shapes.wormhole.draw(graphics_state, model2.times(Mat4.rotation(Math.PI/8, Vec.of(0,1,0))).times(Mat4.scale([1,1,.5])), this.materials.wormholeParticle.override({color: Color.of(0.25, 0.25, 8.25, 1.0), lifetimeFraction: 5}));
        this.shapes.big_wormhole.draw(graphics_state, model2.times(Mat4.rotation(Math.PI/4, [0,0,1])).times(Mat4.scale([1,1,.5])), this.materials.wormholeParticle.override({color: Color.of(0.25, 0.25, 8.25, 1.0), lifetimeFraction: 5}));


        let model3 = Mat4.translation([125, 100, -300]);
        model3 = model3.times(Mat4.scale([1.5,1.5,1.5]));
        this.shapes.sphere.draw(graphics_state, model3.times(Mat4.scale([1.5,1.5,1.5])), this.materials.basic);
        this.shapes.wormhole.draw(graphics_state, model3.times(Mat4.rotation(-Math.PI/8, Vec.of(0,1,0))).times(Mat4.scale([1,1,.5])), this.materials.wormholeParticle.override({color: Color.of(0.25, 0.25, 8.25, 1.0), lifetimeFraction: 5}));
        this.shapes.big_wormhole.draw(graphics_state, model3.times(Mat4.rotation(Math.PI/4, [0,0,1])).times(Mat4.scale([1,1,.5])), this.materials.wormholeParticle.override({color: Color.of(0.25, 0.25, 8.25, 1.0), lifetimeFraction: 5}));

      }

    }
    draw_fire(graphics_state, t)
    {
      this.fire_list.reset_pointer();
      const len = this.fire_list.length();
      for (var i = 0; i < len; i++)
      {
        let temp = this.fire_list.get_current_node();
        let temp_bounding_box = temp.get_bounding_box();
        // Keep moving the ground (and spikes) toward us if the game is not paused.
        let model = undefined;
        if (temp.object_type() == 'fire' || temp.object_type() == 'start_game_fire')
        {
          if (!this.pause)
            temp_bounding_box.translate([0,0,this.movement_speed*(t-temp.time())]);

          model = temp_bounding_box.get_transform();
        }
        else if (temp.object_type() == 'comet_fire') 
        {
          model = temp.transform();
          let delta_t = t - temp.time();
          let move_x = temp.parameters.movement[0];
          let move_y = temp.parameters.movement[1];
          let move_z = temp.parameters.movement[2];
          model = model.times(Mat4.translation([move_x*delta_t,move_y*delta_t,move_z*delta_t]));
        }
        if ((temp_bounding_box != undefined && temp_bounding_box.minZ > 20) || (temp.object_type() == 'comet_fire' && model[0][3] > 200)) {
          this.fire_list.remove_current_node();
        }
        else
        {
          this.fire_list.advance_node();
          if (temp.object_type() == 'fire')
            this.shapes.fire.draw(graphics_state, model.times(Mat4.scale([8,8,8])), this.materials.fireParticle);
          else if (temp.object_type() == 'end_game_fire') {
            model = temp_bounding_box.get_transform();
            this.shapes.fire.draw(graphics_state, model.times(Mat4.scale([20,20,20])), this.materials.fireParticle);
          }
          else if (temp.object_type() == 'start_game_fire')
          {
            model = temp_bounding_box.get_transform();
            this.shapes.fire.draw(graphics_state, model.times(Mat4.scale([5,5,5])).times(Mat4.translation([0,-0.2,0])), this.materials.fireParticle.override({color:temp.parameters.color}));
          }
          else if (temp.object_type() == 'comet_fire')
          {
            model = model.times(temp.parameters.post_trans);
            this.shapes.fire.draw(graphics_state, model.times(Mat4.scale([10,10,10])), this.materials.comet_fire);
          }
        }
      }
    }
    draw_ground(graphics_state, t)
    {
      this.ground.reset_pointer();
      const len = this.ground.length();
      for (var i = 0; i < len; i++)
      {
        let temp = this.ground.get_current_node();
        let temp_bounding_box = temp.get_bounding_box();
        // Keep moving the ground (and spikes) toward us if the game is not paused.
        if (!this.pause)
          temp_bounding_box.translate([0,0,this.movement_speed*(t-temp.time())]);

        let model = temp_bounding_box.get_transform();
        if (temp_bounding_box.minZ > 20 ) {  // z coord of ground is 200, so we can get rid of this ground object.
          this.ground.remove_current_node();
        }
        else 
        {
          this.ground.advance_node(); // move the pointer through the list if there was no deletion
          // Draw the ground relative to the cube's current x coord.
          if (temp.object_type() == 'ground')
          {
            if (temp.parameters.object == 'long_box') {
              if (this.current_scene == "earth")
                this.shapes.long_box.draw(graphics_state, model, this.materials.ground1);
              else
                this.shapes.long_box.draw(graphics_state, model, this.materials.ground2);
            }
            else {
              if (this.current_scene == "earth")
                this.shapes.box.draw( graphics_state, model, this.materials.ground1 );
              else
                this.shapes.box.draw( graphics_state, model, this.materials.ground2 );
            }
          }
          else if (temp.object_type() == 'spike')
            this.shapes.spike.draw(graphics_state, model.times(Mat4.rotation(graphics_state.animation_time/1000, Vec.of(0,1,0))), this.materials.spike);
        }
      }
    }
    update_score(newScore) {  // newScore: int
      this.score.innerHTML = "SCORE: " + newScore.toFixed(0);
      if (newScore > this.high_score_val) {
        this.high_score_val = newScore;
      }
      this.high_score.innerHTML = "HIGH SCORE: " + this.high_score_val.toFixed(0);
    }
    show_special_mode_display() {
      // Display "SPECTATOR MODE" or "INVINCIBILITY MODE ON" in top left corner
      if (this.invincible && this.spectator)
      {
        this.special_mode_display.innerHTML = "SPECTATOR MODE ON";
        this.special_mode_display_tag.innerHTML = "TO TURN OFF: [y]";
      }

      else if (this.invincible)
      {
        this.special_mode_display.innerHTML = "INVINCIBILITY MODE ON";
        this.special_mode_display_tag.innerHTML = "TO TURN OFF: [t]";
      }
      else
      {
        this.special_mode_display.innerHTML = "";
        this.special_mode_display_tag.innerHTML = "";
      }
    }
    show_pause_display() {
      // Display "THE GAME IS PAUSED" at the top of the screen
      if (this.playing_bomber_intro || this.game_over || !this.pause)
        this.pause_display.innerHTML = "";
      else
        this.pause_display.innerHTML = "GAME PAUSED - PRESS [P] TO RESUME.";
    }
    show_stage_display(t) {
      // Briefly display stage number and short message at the start of each stage
      const display_length = 5;  // how long to display each message
      if (this.start && this.current_stage == 1 && t < 5)
        this.stage_display.innerHTML = "STAGE 1 OF 4: WATCH OUT FOR SPIKES!";
      else if (this.current_stage == 2 && t - this.second_stage_start_time < display_length)
        this.stage_display.innerHTML = "STAGE 2 OF 4: DON'T TOUCH A BOMB!";
      else if (this.current_stage == 3 && t - this.third_stage_start_time < display_length)
        this.stage_display.innerHTML = "STAGE 3 OF 4: AVOID THE ASTEROIDS!";
      else if (this.current_stage == 4 && t - this.fourth_stage_start_time < display_length)
        this.stage_display.innerHTML = "FINAL STAGE: THE UFO IS MAD! GOOD LUCK!";
      else
        this.stage_display.innerHTML = "";
    }
    show_game_over_msg() {
      if (this.game_over)
        this.game_over_msg.innerHTML = "You died! Press [R] to restart!";
      else
        this.game_over_msg.innerHTML = "";
    }
    spawn_bomb(t)
    {
      if (t - this.bomb_timer > this.last_time_bomb)
      {
        this.last_time_bomb = t;

        // Since the bomb obj file is not centered properly, we need to translate and scale it manually
        // so that it fits inside a default-size bounding box: 2x2x2 (width=height=length=1).
        const x_correction = -0.01;
        const y_correction = 0.35;
        const z_correction = 0;
        const x_scale = 1.1;
        const y_scale = 1.;
        const z_scale = 1.;
        let bomb_transform = this.bomber_transform.times(Mat4.translation([x_correction,y_correction,z_correction]));

        let x = this.bomber_transform[0][3];
        let y = this.bomber_transform[1][3];
        let z = this.bomber_transform[2][3];
        let bomb_center = [x,y,z];

        const width = 1;
        const length = 1;
        const height = 1;
        const manual_scale = [x_scale, y_scale, z_scale];
        this.bombs.push(bomb_transform, t, 'bomb', new Bounding_Box(bomb_center, bomb_transform, width, length, height, manual_scale));
        // Note: Manual scaling MUST happen at the end of the post-multiplication series
      }
    }
    draw_bomb(graphics_state, t)
    {
      this.bombs.reset_pointer();
      const len = this.bombs.length();
      for (var i = 0; i < len; i++)
      {
        let temp = this.bombs.get_current_node();
        let temp_bounding_box = temp.get_bounding_box();

        // Keep moving the bombs down and forward if the game is not paused.
        let ret = []; // 2 element array returned by translate()
        let bomb_hit_ground = false;
        let bomb_hit_player = false;
        if (!this.pause) {
          let delta_t = t - temp.time();
          let initial_fall_velocity = -0.25;
          let delta_y = initial_fall_velocity*delta_t - .5*this.gravity_constant*(delta_t**2)*.005;

          // We need to pass in the main_cube's bounding box into the bomb's translate().
          // If we don't do it this way, we'll need to change the translate() definition and parameters.
          let main_cube_center = [this.temp_box_transform[0][3], this.temp_box_transform[1][3], this.temp_box_transform[2][3]];
          let main_cube_bounding_box = new Bounding_Box(main_cube_center, this.temp_box_transform);

          ret = temp_bounding_box.translate([0,delta_y,this.bomb_speed*(t-temp.time())], [this.ground], "bomb", main_cube_bounding_box, true);
          bomb_hit_ground = ret[0];
          bomb_hit_player = ret[1];
          if (bomb_hit_player && !this.invincible) {
            this.game_over = true;
            this.bombs.remove_current_node();
            return;
          }
        }
        let model = temp_bounding_box.get_transform();
        if (model[2][3] > 20) {  // pop bomb off list
          this.bombs.remove_current_node();
        }
        else
        {
          this.shapes.bomb.draw(graphics_state, model, this.materials.bomb);
          this.bombs.advance_node();
        }
      }
    }
    draw_bomber_and_bombs(graphics_state, t) {
      // Bomber entry
      let bomber_x = 5 * Math.sin(2*t);
      if (t > this.bomber_entry_time && !this.played_bomber_intro) {
        // Only play siren once (per game)
        if (!this.played_bomb_siren) {
          this.bgm2.pause();
          this.bomb_siren.play();
          this.played_bomb_siren = true;
        }
        this.playing_bomber_intro = true;

        
        // DO NOT move the bomber scaling.
        this.pause = true;
        this.bomber_transform = this.temp_box_transform.times(Mat4.translation([bomber_x,25,-70]));
        this.shapes.ufo.draw( graphics_state, this.bomber_transform.times(Mat4.scale([3,3,3])), this.materials.ufo);

/////////////////////////////////////////////////////////////
// DO NOT REMOVE UNTIL WE FINISH: MOOJ'S BOMB TESTING CODE
/////////////////////////////////////////////////////////////

//           this.bomber_transform = this.temp_box_transform.times(Mat4.translation([bomber_x,25,-70]));
//           this.shapes.main_cube.draw( graphics_state, this.bomber_transform.times(Mat4.scale([1,1,1])), this.materials.background1);

//         // Since the bomb obj file is not centered properly, we need to translate and scale it manually
//         // so that it fits inside a default-size bounding box: 2x2x2 (width=height=length=1).
//         const x_correction = 0;
//         const y_correction = 0;
//         const z_correction = 0;
//         const x_scale = 1.;
//         const y_scale = 1.;
//         const z_scale = 1.;
//         let bomb_transform = this.bomber_transform.times(Mat4.translation([x_correction,y_correction,z_correction]));

//         let x = this.bomber_transform[0][3];
//         let y = this.bomber_transform[1][3];
//         let z = this.bomber_transform[2][3];
//         let bomb_center = [x,y,z];

//         const width = 1;
//         const length = 1;
//         const height = 1;
//         const manual_scale = [x_scale, y_scale, z_scale];
//         this.bombs.push(bomb_transform, t, 'bomb', new Bounding_Box(bomb_center, bomb_transform, width, length, height, manual_scale));
// //         this.bombs.push(bomb_transform, t, 'bomb', new Bounding_Box(bomb_center, bomb_transform, width, length, height));
//         // Note: Manual scaling MUST happen at the end of the post-multiplication series


//       const bombs_length = this.bombs.length();
//       for (var i = 0; i < bombs_length; i++)
//       {
//         let temp = this.bombs.next();
//         let temp_bounding_box = temp.get_bounding_box();

//         // Keep moving the bombs down and forward if the game is not paused.
//         let ret = []; // 2 element array returned by translate()
//         let bomb_hit_ground = false;
//         let bomb_hit_player = false;
//         if (!this.pause) {
//           let delta_t = t - temp.time();
//           let initial_fall_velocity = -0.25;
//           let delta_y = initial_fall_velocity*delta_t - .5*this.gravity_constant*(delta_t**2)*.005;

//           // We need to pass in the main_cube's bounding box into the bomb's translate().
//           // If we don't do it this way, we'll need to change the translate() definition and parameters.
//           let main_cube_center = [this.temp_box_transform[0][3], this.temp_box_transform[1][3], this.temp_box_transform[2][3]];
//           let main_cube_bounding_box = new Bounding_Box(main_cube_center, this.temp_box_transform);

//           ret = temp_bounding_box.translate([0,delta_y,this.bomb_speed*(t-temp.time())], [this.ground], "bomb", main_cube_bounding_box, true);
//           bomb_hit_ground = ret[0];
//           bomb_hit_player = ret[1];
// //           if (bomb_hit_ground && i == 0) {
// //               this.bombs.pop();
// //           }
//           if (bomb_hit_player && !this.invincible) {
//             this.game_over = true;
//             this.bombs.delete(temp);
//             return;
//           }
//         }
//         let model = temp_bounding_box.get_transform();
//         if (model[2][3] >= 15 && i == 0) {  // pop bomb off list
//           this.bombs.pop();
//         }
//         this.shapes.bomb.draw(graphics_state, model, this.materials.bomb);
//       }


//////////////////////////////////////////////////////////////////////
// The definition of draw_bomb() goes here if you uncomment the above.
//////////////////////////////////////////////////////////////////////

        // Point camera at bomber
        let model_transform_camera = this.bomber_transform; // point the camera at bomber
        model_transform_camera = model_transform_camera.times( Mat4.translation([0,0,12]) );
        model_transform_camera = Mat4.inverse( model_transform_camera );
        this.target_model_transform_camera = model_transform_camera;
        model_transform_camera = model_transform_camera.map( (x,i) => Vec.from( graphics_state.camera_transform[i] ).mix( x, 0.1 ) );
        graphics_state.camera_transform = model_transform_camera;

        // Resume game when user presses 'c' or when 3 seconds pass
        if (this.continue || this.paused_time > 2) {
          this.played_bomber_intro = true;
          this.continue = false;
          this.pause = false;
          this.bgm2.play();
          this.playing_bomber_intro = false;
        }
      }
      // Draw bomber and bombs
      if (this.played_bomber_intro) {
        // DO NOT move the bomber scaling.
        this.bomber_transform = this.temp_box_transform.times(Mat4.translation([bomber_x,25,-70]));
        this.shapes.ufo.draw( graphics_state, this.bomber_transform.times(Mat4.scale([3,3,3])), this.materials.ufo);
        this.spawn_bomb(t);
        this.draw_bomb(graphics_state, t);
      }
    }
    draw_explosions(graphics_state, t, t2)
    {
      if (this.game_over)
        t = t2;
      this.explosions.reset_pointer();
      const len = this.explosions.length();
      for (var i = 0; i < len; i++)
      {
        let temp = this.explosions.get_current_node();
        if (temp.parameters.expiration > t)
        {
          this.explosions.advance_node();
          let temp_bounding_box = temp.get_bounding_box();
          if (!this.pause)
            temp_bounding_box.translate([0,0,this.movement_speed*(t-temp.time())]);

          let model = temp_bounding_box.get_transform();
          if (temp.object_type() == 'asteroid_explosion')
          {
            let size = temp.parameters.scale;
            let fade = (temp.parameters.expiration - t)/this.asteroid_explosion_time;
            if (temp.parameters.rotate_left == true)
            {
              size = size/3;
              model = model.times(Mat4.rotation(Math.PI/2, Vec.of(0,0,1)));
            }
            this.shapes.explosion.draw(graphics_state, model.times(Mat4.scale([size,size,size])), this.materials.fireParticle.override({lifetimeFraction: fade}));
          }
          else if (temp.object_type() == 'end_game_explosion')
          {
            let fade = 2*(temp.parameters.expiration - t)/this.final_explosion_time;
            this.shapes.big_explosion.draw(graphics_state, model.times(Mat4.scale([15,15,15])), this.materials.fireParticle.override({lifetimeFraction: fade}));
          }
        }
        else
        {
          this.explosions.remove_current_node();
        }
      }
    }
    display( graphics_state )
      { 
        const total_time = graphics_state.animation_time/1000, dt = graphics_state.animation_delta_time / 1000;
        if (!this.start) {
          this.start_time = total_time;
          this.incremental_time = total_time;
          this.incremental_time2 = total_time;
        }
        if (!this.pause && this.start) {
          this.incremental_time = this.incremental_time + dt;
          this.incremental_time2 = this.incremental_time2 + dt;
        }
        else if (this.game_over || (this.start && !this.pause))
          this.incremental_time2 = this.incremental_time2 + dt;

        let t = this.incremental_time - this.start_time; // t is the amount of time that has elapsed since the user started the game
        let t2 = this.incremental_time2 - this.start_time;
        if (this.pause) this.paused_time = this.paused_time + dt;
        if (this.game_over)
        {                                     // DO NOT MOVE THIS CODE!
          this.end_game(graphics_state, t);
          if (this.restart)
          {
            this.make_stage1();
            return;
          }
        }

        // Start Second Stage
        if (t >= this.second_stage_start_time && this.current_scene == "earth") {
          this.current_scene = "space";
          this.current_stage = 2;
          this.lights = [ new Light( Vec.of( 0,5,-70,1 ), Color.of( 1, 0, 1, 1 ), 100000 ),
          new Light( Vec.of( 0,5,10,1 ), Color.of( 1, 0, 1, 1 ), 100000 )];

          this.bgm1.pause(); this.bgm1.currentTime = 0;  // Stop the first song
        }
        if (t > this.second_stage_start_time + 1 && this.current_scene == "space") {  // Without this spacing, the cheering sound
          this.bgm2.play();                                                        // and the new bgm cause a load() error.
        }

        // Start Third Stage
        if (t >= this.third_stage_start_time && !this.played_cheering_sound1) {
          this.cheering_sound.play();
          this.current_stage = 3;
          this.played_cheering_sound1 = true;
        }

        // Start Fourth Stage
        if (t >= this.fourth_stage_start_time && !this.played_cheering_sound2) {
          this.cheering_sound.play();
          this.current_stage = 4;
          this.bomb_timer = 0.15;
          this.played_cheering_sound2 = true;
        }

        this.draw_bomber_and_bombs(graphics_state, t);

        this.move_box(graphics_state, t); // move the user's box

        this.update_score(10*t);

        this.draw_special_objects(graphics_state, t);

        this.draw_background(graphics_state, t);

        if (this.current_stage == "earth")
        {
         this.shapes.main_cube.draw( graphics_state, this.temp_box_transform, this.materials.fun_texture1 ); // draw the user's box
        }
        else
        {
         this.shapes.main_cube.draw( graphics_state, this.temp_box_transform, this.materials.fun_texture2 ); // change box texture
        }
        
        if (!this.game_over)
          this.spawn_ground(t);

        this.draw_ground(graphics_state, t);

        this.draw_fire(graphics_state, t); // draw the fire last so its transparency blends correctly

        this.draw_explosions(graphics_state, t, t2); // explosions are also fire, draw last
        
        this.show_special_mode_display();
        this.show_pause_display();
        this.show_stage_display(t);
        this.show_game_over_msg();
      }
  }
