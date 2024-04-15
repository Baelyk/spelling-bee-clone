import { invoke } from "@tauri-apps/api/core";

const COLORS = {
  yellow: "gold",
  darkyellow: "goldenrod",
  black: "black",
  gray: "lightgray",
  darkgray: "darkgray",
  red: "red",
  white: "white",
};

const FONTS = {
  controls: "JetBrains Mono, monospace",
  loading: "Arial",
  wheel: "JetBrains Mono, monospace",
  word: "JetBrains Mono, monospace",
}

const SIZES = {
  big: (game: Game) => game.height / 10,
  medium: (game: Game) => game.height / 15,
  small: (game: Game) => game.height / 28,
  tiny: (game: Game) => game.height / 40,
}

interface Game {
  width: number;
  height: number;
  ctx: CanvasRenderingContext2D;

  puzzle_promise: Promise<unknown>;
  letters: string[];
  words: Set<string>;
  word: string;
  found: Set<string>;

  mouseX: number;
  mouseY: number;
  mouseDown: boolean;

  clickedHex: number | null;
  clickedHexTime: DOMHighResTimeStamp | null;
}

window.addEventListener("DOMContentLoaded", () => {
  const game = init();
  if (game == null) {
    console.error("Error initializing game");
    return;
  }

  game.puzzle_promise.then(message => {
    game.letters = message[0];
    game.words = new Set(message[1]);
  });

  window.addEventListener("click", (event) => {
    console.log("click");
    game.mouseX = event.clientX;
    game.mouseY = event.clientY;
    game.mouseDown = true;
    window.requestAnimationFrame((time) => main(time, game));
  });

  window.addEventListener("mousemove", (event) => {
    console.log("mouse");
    game.mouseX = event.clientX;
    game.mouseY = event.clientY;
    game.mouseDown = false;
    window.requestAnimationFrame((time) => main(time, game));
  });

  window.requestAnimationFrame((time) => main(time, game));
});

function init(): Game | undefined {
  console.log("Initializing...");
  const canvas = document.querySelector("canvas");
  if (canvas == null) {
    console.error("Unable to get canvas");
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (ctx == null) {
    console.error("Unable to get canvas context");
    return;
  }

  const letters: string[] = [];
  const words: Set<string> = new Set();

  const puzzle_promise = invoke("new_puzzle");

  return {
    width,
    height,
    ctx,

    puzzle_promise,
    letters,
    word: "",
    words,
    found: new Set(),

    mouseX: -1,
    mouseY: -1,
    mouseDown: false,

    clickedHex: null,
    clickedHexTime: null,
  };
}

function main(time: DOMHighResTimeStamp, game: Game) {
  game.ctx.clearRect(0, 0, game.width, game.height);

  if (game.letters.length === 0) {
    loading(time, game);
    return;
  }

  const clicked = wheel(time, game);
  game.word += clicked;
  if (clicked) {
    console.log(game.word);
  }

  word(time, game);

  controls(time, game);
}

function loading(time: DOMHighResTimeStamp, game: Game) {
  console.log("Loading...");
  window.requestAnimationFrame((time) => main(time, game));

  game.ctx.font = `bold ${SIZES.big(game)}px ${FONTS.loading}`;
  game.ctx.textAlign = "left";
  game.ctx.textBaseline = "middle";

  const dots = ".".repeat((time / 250) % 4);
  game.ctx.fillText(`Loading${dots}`, game.width / 2 - game.ctx.measureText("Loading. . .").width / 2, game.height / 2);
}

/**
 * Draw the hexagon letter wheel
 */
function wheel(time: DOMHighResTimeStamp, game: Game) {
  let clicked = "";
  const hexRadius = SIZES.big(game);

  game.ctx.font = `bold ${hexRadius}px ${FONTS.wheel}`
  game.ctx.textAlign = "center";
  game.ctx.textBaseline = "middle";

  // Center hexagon
  const centerX = game.width / 2;
  const centerY = game.height - hexRadius * 4.5;
  hexagon(game.ctx, centerX, centerY, hexRadius);
  if (game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.clickedHex = 0;
      game.clickedHexTime = time;
      clicked = game.letters[0];
      game.ctx.fillStyle = COLORS.darkyellow;
    } else {
      game.ctx.fillStyle = COLORS.darkyellow;
    }
  } else {
    game.ctx.fillStyle = COLORS.yellow;
  }
  if (game.clickedHex === 0 && game.clickedHexTime != null) {
    const duration = 200;
    let t = (time - game.clickedHexTime) / duration;
    if (t < 1) {
      // Hex shrinks then grows
      if (t > 0.5) {
        t = 1 - t;
      }
      window.requestAnimationFrame((time) => main(time, game));
      const clickedHexRadius = (1 - t) * hexRadius + t * (0.8 * hexRadius);
      hexagon(game.ctx, centerX, centerY, clickedHexRadius);
    } else {
      game.clickedHex = null;
      game.clickedHexTime = null;
    }
  }
  game.ctx.fill();
  game.ctx.fillStyle = COLORS.black;
  game.ctx.fillText(game.letters[0], centerX, centerY);

  // Surrounding hexagons
  const radians = 2 * Math.PI / 6;
  const radius = 1.9 * hexRadius;
  for (let i = 1; i <= 6; i++) {
    const x = centerX + Math.cos(radians * i + radians / 2) * radius;
    const y = centerY + Math.sin(radians * i + radians / 2) * radius;
    hexagon(game.ctx, x, y, hexRadius);
    if (game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
      if (game.mouseDown) {
        game.mouseDown = false;
        game.clickedHex = i;
        game.clickedHexTime = time;
        clicked = game.letters[i];
        game.ctx.fillStyle = COLORS.darkgray;
      } else {
        game.ctx.fillStyle = COLORS.darkgray;
      }
    } else {
      game.ctx.fillStyle = COLORS.gray;
    }
    if (game.clickedHex === i && game.clickedHexTime != null) {
      const duration = 200;
      let t = (time - game.clickedHexTime) / duration;
      if (t < 1) {
        // Hex shrinks then grows
        if (t > 0.5) {
          t = 1 - t;
        }
        window.requestAnimationFrame((time) => main(time, game));
        const clickedHexRadius = (1 - t) * hexRadius + t * (0.8 * hexRadius);
        hexagon(game.ctx, x, y, clickedHexRadius);
      } else {
        game.clickedHex = null;
        game.clickedHexTime = null;
      }
    }
    game.ctx.fill();
    game.ctx.fillStyle = COLORS.black;
    game.ctx.fillText(game.letters[i], x, y);
  }

  return clicked;
}

function word(time: DOMHighResTimeStamp, game: Game) {
  let size = SIZES.medium(game);
  game.ctx.font = `bold ${size}px ${FONTS.word}`;
  game.ctx.textAlign = "center";
  game.ctx.textBaseline = "middle";
  while (game.ctx.measureText(game.word).width > game.width * 0.75) {
    size = size * 0.95;
    game.ctx.font = `bold ${size}px ${FONTS.word}`;
  }

  game.ctx.fillText(game.word, game.width / 2, game.height / 10);
}

function controls(time: DOMHighResTimeStamp, game: Game) {
  const controlY = game.height * 0.9;
  const controlRadius = SIZES.small(game);
  game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.controls}`;
  game.ctx.textAlign = "center";
  game.ctx.textBaseline = "middle";

  // Delete
  const deleteX = game.width / 2 - controlRadius * 4;
  game.ctx.beginPath();
  game.ctx.arc(deleteX - controlRadius, controlY, controlRadius, Math.PI / 2, Math.PI * 3 / 2)
  game.ctx.arc(deleteX + controlRadius, controlY, controlRadius, Math.PI * 3 / 2, Math.PI / 2)
  game.ctx.closePath();
  if (game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.ctx.fillStyle = COLORS.darkgray;
      game.word = game.word.substring(0, game.word.length - 1);
      window.requestAnimationFrame((time) => main(time, game));
    } else {
      game.ctx.fillStyle = COLORS.gray;
    }
  } else {
    game.ctx.fillStyle = COLORS.white;
  }
  game.ctx.lineWidth = 1;
  game.ctx.stroke();
  game.ctx.fill();
  game.ctx.fillStyle = COLORS.black;
  game.ctx.fillText("Delete", deleteX, controlY);

  // Shuffle
  game.ctx.beginPath();
  game.ctx.arc(game.width / 2, controlY, controlRadius, 0, 2 * Math.PI)
  if (game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.ctx.fillStyle = COLORS.darkgray;
      game.letters = game.letters
        .map((letter, i) => ({ letter, sort: i === 0 ? 0 : Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ letter }) => letter);
      window.requestAnimationFrame((time) => main(time, game));
    } else {
      game.ctx.fillStyle = COLORS.gray;
    }
  } else {
    game.ctx.fillStyle = COLORS.white;
  }
  game.ctx.lineWidth = 1;
  game.ctx.stroke();
  game.ctx.fill();

  // Enter
  const enterX = game.width / 2 + controlRadius * 4;
  game.ctx.beginPath();
  game.ctx.arc(enterX - controlRadius, controlY, controlRadius, Math.PI / 2, Math.PI * 3 / 2)
  game.ctx.arc(enterX + controlRadius, controlY, controlRadius, Math.PI * 3 / 2, Math.PI / 2)
  game.ctx.closePath();
  if (game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.ctx.fillStyle = COLORS.darkgray;

      if (game.words.has(game.word.toLowerCase())) {
        console.log("Found word!");
      } else {
        console.log("no");
      }
      game.word = "";

      window.requestAnimationFrame((time) => main(time, game));
    } else {
      game.ctx.fillStyle = COLORS.gray;
    }
  } else {
    game.ctx.fillStyle = COLORS.white;
  }
  game.ctx.lineWidth = 1;
  game.ctx.stroke();
  game.ctx.fill();
  game.ctx.fillStyle = COLORS.black;
  game.ctx.fillText("Enter", enterX, controlY);
}

/**
 * Path a hexagon centered at x, y with specified radius. Rotated to have a side
 * at the top and bottom, and a vertex at the left and right. Does not draw!
 */
function hexagon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  const sides = 6;
  const radians = 2 * Math.PI / sides;

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  for (let i = 1; i <= sides; i++) {
    ctx.lineTo(x + Math.cos(radians * i) * radius, y + Math.sin(radians * i) * radius);
  }
}

/**
 * Path a triangle centered at x, y with specified radius. Rotated to have one
 * vertex to the right. Does not draw!
 */
function triangle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  const sides = 3;
  const radians = 2 * Math.PI / sides;

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  for (let i = 1; i <= sides; i++) {
    ctx.lineTo(x + Math.cos(radians * i) * radius, y + Math.sin(radians * i) * radius);
  }
}
