# Secret Box Jumper

Secret Box Jumper is a 3D platform game where the player continuously jumps onto oncoming platforms to avoid death. 
In addition to jumping between platforms, there are obstacles to avoid such as spikes, asteroids, bombs, and fire. 
The game will transition into more difficult stages as you jump to greater heights!

## How to Run and Play

1. git clone this repository.
2. Run the local server: ./host.command (for Mac) or ./host.bat (for Windows)
3. Go to localhost:8000 in your favorite browser.
4. Peruse the gameplay instructions that appear upon web initialization for game controls.
5. Press [b] to begin, and jump onto the approaching platforms while dodging obstacles.

## Procedural Game Stages

1. Earth: The sky is peaceful with small fires along the first platform and a few spikes here and there.
2. Space + UFO Bomber Entry: A UFO drags you into space in an instant and throws bombs toward you.
3. Space + Asteroids: A shower of deadly asteroids comes your way, exploding upon impact with the ground.
4. Space + Angry UFO Bomber: The enraged UFO launches bombs at a much greater rate.

## Testing

If the game is too difficult and you would like to view all stages without dying, here are 2 special modes that you could use:

```

Invincibility Mode [t]
  - You cannot die to obstacles.
  - If you fall off a platform, you will fall forever unless you disable invincibility and restart.

Spectator Mode [y]
  - You cannot die to obstacles.
  - Player movement and controls are disabled.
  - The camera will go through the entire game; thus, you will act like a spectator.

```
You can also pause the game by pressing [p]. Pressing [0] afterwards frees the camera, which you can control
with the mouse and the keys listed in the Movement_Controls table under our game if you scroll down.

## Advanced Topics

* **Collision Detection** - Bounding boxes are used to detect player interactions with platforms, spikes, bombs, fires, and asteroids. Bombs and asteroids interact with the platforms as well.

* **Normal Mapping** - Normal mapping distorts the normal vectors of an object on a per fragment basis to alter the effect of light on the surface of the object, which adds detail to the object's surface. In our game, normal mapping improves the appearances of the platforms, spikes, asteroids, comets, etc.

* **Particle Shader Program** - A complete custom shader program that generates a user-inputted amount of particles, each with their own attributes, using texture atlassing and billboard camera effects to animate each particle and pan the camera to always face the user. The particle system uses additive blending for a bright neon effect, and each particle has its own projectile motion, which cohesively interacts with each another to create many physics effects such as dynamic explosions, burning fires, and gravitational wormholes. 

## Minor Features

* **Physics** - Gravity, initial velocity, and time are used to calculate displacement for the jumping player and falling bombs. Particle path of motion is also computed using physics such as velocity/displacement and logarithmic spiral equations.

* **OBJ Loader** - Used to load shapes for the UFO and bombs.

* **Music & Sound Effects** - Background music and various sound effects for entertainment.

* **HTML/CSS Overlay** - Text on screen improves gameplay.

## Authors' Contributions

* **Eddie Hu** - *Implemented the Particle Generator Shader Program. This includes: vertex glsl shader, fragment glsl shader, billboard camera pan effect, additive blending, texture atlassing, particle projectile motion physics, attribute/uniform/varying mappings, etc). Created Fire and Explosion classes/effects. Created custom Wormhole shader, classes, and effects.* - [ehu23](https://github.com/ehu23)
* **Scott Bauersfeld** - *Implemented procedural generation of the ground and space objects. Created a Matrix_List class that acts as a simple scene graph to maintain all objects' transformations. Developed normal mapping and applied it to ground and space objects. Added capability for asteroids to collide with the ground (using collision detection), causing explosions and leaving behind fire. Used physics to implement jumping animation.* - [sbauersfeld](https://github.com/sbauersfeld)
* **Moo Jin Kim** - *Implemented bounding box class for player's collisions with platforms, bombs, spikes, etc. Implemented game stage transitions. Used OBJ loader for UFO bomber and bombs. Implemented smooth player and camera movement. Developed HTML/CSS overlay. Inserted music and sounds.* - [moojink](https://github.com/moojink)

## Built With

* [WebGL](https://www.khronos.org/webgl/) - The web framework used

## Contributing

Feel free to send pull requests!

## Version

1.0

## License

To be licensed...

## Acknowledgments

* Garett Ridge - Tiny graphics webgl library
* Scott Friedman - Computer graphics knowledge
