# Concept render tools (previews only, not mod code)
- `fishing_rod_texture.py <out-prefix>`: draws the Galaxium Fishing Rod 128px texture (item + cast) and the concept sheet/GIF.
- `scene.html` + `render.js`: three.js scene (Nether lava shore) that shows the rod as an extruded item in the player's hand.
  Setup: `npm install three@0.160.0` next to these files, copy the `-item-128.png` / `-cast-128.png` textures in as
  `rod-item-128.png` / `rod-cast-128.png`, then `node render.js <outdir> 2 fp_idle fp_cast tp_cast`
  (append `:{json}` to a view to tune positions).
