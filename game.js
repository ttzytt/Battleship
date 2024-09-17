/*
game.js for Perlenspiel 3.3.x
Last revision: 2022-03-15 (BM)

Perlenspiel is a scheme by Professor Moriarty (bmoriarty@wpi.edu).
This version of Perlenspiel (3.3.x) is hosted at <https://ps3.perlenspiel.net>
Perlenspiel is Copyright © 2009-22 Brian Moriarty.
This file is part of the standard Perlenspiel 3.3.x devkit distribution.

Perlenspiel is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Perlenspiel is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Lesser General Public License for more details.

You may have received a copy of the GNU Lesser General Public License
along with the Perlenspiel devkit. If not, see <http://www.gnu.org/licenses/>.
*/

/*
This JavaScript file is a template for creating new Perlenspiel 3.3.x games.
Any unused event-handling function templates can be safely deleted.
Refer to the tutorials and documentation at <https://ps3.perlenspiel.net> for details.
*/

/*
The following comment lines are for JSHint <https://jshint.com>, a tool for monitoring code quality.
You may find them useful if your development environment is configured to support JSHint.
If you don't use JSHint (or are using it with a configuration file), you can safely delete these two lines.
*/

/* jshint browser : true, devel : true, esversion : 6, freeze : true */
/* globals PS : true */

"use strict"; // Do NOT remove this directive!

/* 
list of diff colors: 

COLOR_BLACK:0,COLOR_WHITE:16777215,COLOR_GRAY_LIGHT:12632256,COLOR_GRAY:8421504,
COLOR_GRAY_DARK:4210752,COLOR_RED:16711680,COLOR_ORANGE:16744448,COLOR_YELLOW:
16776960,COLOR_GREEN:65280,COLOR_BLUE:255,COLOR_INDIGO:4194559,COLOR_VIOLET:8388863,
COLOR_MAGENTA:16711935,COLOR_CYAN:65535,

*/

// ----------------- constants -----------------

const GAME_GRID_X_SZ = 12 // grid size x
const GAME_GRID_Y_SZ = 12 // grid size y
const CTRL_PANEL_ROW = GAME_GRID_Y_SZ;
// const SHIP_LENS = [2, 2, 3, 3, 4, 4, 5] // ship lengths
const SHIP_LENS = [2, 3]
const SHIP_COLORS = [PS.COLOR_GRAY, PS.COLOR_GRAY, PS.COLOR_GRAY,
PS.COLOR_GRAY, PS.COLOR_GRAY, PS.COLOR_GRAY,
PS.COLOR_GRAY] // ship colors
const SHIP_HIT_COLOR = PS.COLOR_ORANGE;
const SHIP_SUNK_COLOR = PS.COLOR_RED;
const DEF_STATUS_TEXT = "battleship game";


const DEF_BEAD = {
	color: PS.COLOR_GRAY_DARK,
	borderColor: PS.COLOR_GRAY
}

const DEF_CTRL_BEAD = {
	color: PS.COLOR_BLACK,
	glyphColor: PS.COLOR_WHITE,
	borderColor: PS.COLOR_BLACK
}

const CCW_ROTATE_GLYPH = "↺";
const CW_ROTATE_GLYPH = "↻";
const GAME_STATE = Object.freeze({
	A_PLACING: { side: "A", state: "placing" },
	B_PLACING: { side: "B", state: "placing" },
	A_ATTACKING: { side: "A", state: "attacking" },
	B_ATTACKING: { side: "B", state: "attacking" },
	END: { side: "_", state: "end" }
});// game states

const MOVES = Object.freeze({
	LEFT: { dx: -1, dy: 0 },
	RIGHT: { dx: 1, dy: 0 },
	UP: { dx: 0, dy: -1 },
	DOWN: { dx: 0, dy: 1 }
});

const CTRL_OPTIONS = Object.freeze({
	ROTATE_CW: { option: "rotate_cw", glyph: CW_ROTATE_GLYPH, x: 0 },
	ROTATE_CCW: { option: "rotate_ccw", glyph: CCW_ROTATE_GLYPH, x: 1 },
	MOV_LEFT: { option: "move_left", glyph: "←", x: 2, move: MOVES.LEFT },
	MOV_RIGHT: { option: "move_right", glyph: "→", x: 3, move: MOVES.RIGHT },
	MOV_UP: { option: "move_up", glyph: "↑", x: 4, move: MOVES.UP },
	MOV_DOWN: { option: "move_down", glyph: "↓", x: 5, move: MOVES.DOWN },
	SUBMIT: { option: "submit", glyph: "✔", x: 7 },
	CUR_PLAYER: { option: "cur_player", glyph: "A", x: 6 },
});


// ----------------- classes -----------------
class Ship {

	constructor(x, y, len, isVertical, color, sideName) {
		this.x = x;
		this.y = y;
		this.isXYLeftOrTop = true;
		this.len = len;
		this.isVertical = isVertical;
		this.color = color
		this.selectedColor = getContrastingColor(color);
		this.isSelected = false;
		this.isHit = new Array(len).fill(false); // idx 0 is the center
		this.isSunk = false;
		this.sideName = sideName;
	}

	getOccupiedBeads() {
		let occupiedBeads = [];
		if (this.isVertical) {
			for (let i = 0; i < this.len; i++) {
				occupiedBeads.push({
					x: this.x,
					y: this.isXYLeftOrTop ? this.y + i : this.y - i
				});
			}
		} else {
			for (let i = 0; i < this.len; i++) {
				occupiedBeads.push({
					x: this.isXYLeftOrTop ? this.x + i : this.x - i,
					y: this.y
				});
			}
		}
		return occupiedBeads;
	}

	isCollideWithShip(ship) {
		let occupiedBeads = this.getOccupiedBeads();
		let targetOccupiedBeads = ship.getOccupiedBeads();
		// draw a dot in the center
		for (let bead of occupiedBeads) {
			for (let targetBead of targetOccupiedBeads) {
				if (bead.x === targetBead.x && bead.y === targetBead.y) {
					return true;
				}
			}
		}
		return false;
	}

	draw() {
		let occupiedBeads = this.getOccupiedBeads();
		PS.glyph(this.x, this.y, "•");
		for (let bead of occupiedBeads) {
			PS.color(bead.x, bead.y, this.color);
			PS.borderColor(bead.x, bead.y, this.color);
		}
	}

	updGrid(occNotHit, curNotOppData) {
		for (let bead of this.getOccupiedBeads()) {
			let data = curNotOppData ? game.curData : game.opponentData;
			data[bead.x][bead.y].state = occNotHit ? BEAD_STATE.OCCUPIED : BEAD_STATE.HIT;
			data[bead.x][bead.y].occupiedBy = this;
		}
	}

	toggleSelect() {
		this.isSelected = !this.isSelected;
		let temp = this.color;
		this.color = this.selectedColor;
		this.selectedColor = temp;
	}

	getOccupiedBeadsAfterRotate(isCW) {
		let origVer = this.isVertical;
		let origXYLeftOrTop = this.isXYLeftOrTop;
		if (isCW && this.isVertical) {
			this.isXYLeftOrTop = !this.isXYLeftOrTop;
		}
		if (!isCW && !this.isVertical) {
			this.isXYLeftOrTop = !this.isXYLeftOrTop;
		}
		this.isVertical = !this.isVertical;
		let occupiedBeads = this.getOccupiedBeads();
		this.isVertical = origVer;
		this.isXYLeftOrTop = origXYLeftOrTop;
		return occupiedBeads;
	}

	drawRotate(isCW) {
		let origBeads = this.getOccupiedBeads();
		for (let bead of origBeads) {
			drawDefBead(bead.x, bead.y);
			game.curData[bead.x][bead.y] = new BeadData(BEAD_STATE.EMPTY, null);
		}
		if (isCW && this.isVertical) {
			this.isXYLeftOrTop = !this.isXYLeftOrTop;
		}
		if (!isCW && !this.isVertical) {
			this.isXYLeftOrTop = !this.isXYLeftOrTop;
		}
		this.isVertical = !this.isVertical;
		this.draw();
		this.updGrid(true, true);
	}

	getOccupiedBeadsAfterMove(move) {
		return this.getOccupiedBeads().map(bead => {
			return {
				x: bead.x + move.dx,
				y: bead.y + move.dy
			}
		});
	}

	drawMove(move) {
		let origBeads = this.getOccupiedBeads();
		for (let bead of origBeads) {
			drawDefBead(bead.x, bead.y);
			game.curData[bead.x][bead.y] = new BeadData(BEAD_STATE.EMPTY, null);
		}
		this.x += move.dx;
		this.y += move.dy;
		this.draw();
		this.updGrid(true, true);
	}

	hit(x, y) {
		if (this.isVertical) {
			let dy = Math.abs(this.y - y);
			this.isHit[dy] = true;
		} else {
			let dx = Math.abs(this.x - x);
			this.isHit[dx] = true;
		}
		game.opponentData[x][y].state = BEAD_STATE.HIT;
		if (this.isHit.every(hit => hit)) {
			this.isSunk = true;
			this.color = SHIP_SUNK_COLOR;
			for (let bead of this.getOccupiedBeads()) {
				PS.color(bead.x, bead.y, SHIP_SUNK_COLOR);
			}
		}
	}
}

class Player {
	constructor(sideName, ships) {
		this.sideName = sideName;
		this.ships = ships;
		this.shipPosSet = new Set();
		for (let ship of ships) {
			this.shipPosSet.add(ship.getOccupiedBeads());
		}
	}
}

const BEAD_STATE = Object.freeze({
	EMPTY: { state: "empty" },
	HIT: { state: "hit" },
	BOMBED: { state: "bombed" },
	OCCUPIED: { state: "occupied" },
});

class BeadData {
	constructor(state, occupiedBy) {
		this.state = state;
		this.occupiedBy = occupiedBy;
	}
}

class Debug {
	static printBeadState(data = game.curData) {
		/* 
			print something like
			EEHHBBBBOOO
		*/
		for (let j = 0; j < GAME_GRID_Y_SZ; j++) {
			let row = "";
			for (let i = 0; i < GAME_GRID_X_SZ; i++) {
				row += data[i][j].state.state.charAt(0);
			}
			PS.debug(row + "\n");
		}

	}
}

// ----------------- global variables -----------------

let curSelectedShip = null;
let curSelectedBombPos = null;
let playerA = new Player("A", getInitShips("A"));
let playerB = new Player("B", getInitShips("B"));
let beadDataA = new Array(GAME_GRID_X_SZ).fill(null)
	.map(() => new Array(GAME_GRID_Y_SZ).fill(null)
		.map(() => new BeadData(BEAD_STATE.EMPTY, null)));


let beadDataB = new Array(GAME_GRID_X_SZ).fill(null)
	.map(() => new Array(GAME_GRID_Y_SZ).fill(null)
		.map(() => new BeadData(BEAD_STATE.EMPTY, null)));

let game = {
	state: GAME_STATE.A_PLACING,
	isPlacing: true,
	curPlayer: playerA,
	opponentPlayer: playerB,
	curData: beadDataA,
	opponentData: beadDataB,
	submitCnt: 0
}


// ----------------- util https://chatgpt.com/c/66e24548-8cf8-8006-8aae-2d708117282cfunctions -----------------

function getInitShips(sideName) {
	// all ships are placed horizontally.
	// from top-left corner to bottom-left corner
	let ships = [];
	for (let i = 0; i < SHIP_LENS.length; i++) {
		ships.push(new Ship(0, i, SHIP_LENS[i], false, SHIP_COLORS[i], sideName));
	}
	return ships;
}

function getComplColor(color) {
	let colArr = []
	PS.unmakeRGB(color, colArr);
	return PS.makeRGB(255 - colArr[0], 255 - colArr[1], 255 - colArr[2]);
}

function getLuminance(color) {
	let colArr = [];
	PS.unmakeRGB(color, colArr);

	// Normalize the RGB values to [0, 1]
	let r = colArr[0] / 255;
	let g = colArr[1] / 255;
	let b = colArr[2] / 255;

	// Apply the luminance formula
	// Using sRGB luminance formula
	let luminance = 0.2126 * (r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4)) +
		0.7152 * (g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4)) +
		0.0722 * (b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4));

	return luminance;
}

function getContrastingColor(color) {
	let luminance = getLuminance(color);
	let contrastColor = luminance > 0.5 ? PS.makeRGB(0, 0, 0) : PS.makeRGB(255, 255, 255);
	return contrastColor;
}

function swap(a, b) {
	let temp = a;
	a = b;
	b = temp;
}

function flipSide(stillPlacing) {
	if (game.state === GAME_STATE.END) return;
	if (stillPlacing) {
		if (game.state === GAME_STATE.A_PLACING) {
			game.state = GAME_STATE.B_PLACING;
			game.isPlacing = true;
		} else {
			game.state = GAME_STATE.A_PLACING;
			game.isPlacing = true;
		}
	} else {
		if (game.state === GAME_STATE.A_ATTACKING) {
			game.state = GAME_STATE.B_ATTACKING;
			game.isPlacing = false;
		} else {
			game.state = GAME_STATE.A_ATTACKING;
			game.isPlacing = false;
		}
	}
	let tmp = (game.curPlayer);
	game.curPlayer = (game.opponentPlayer);
	game.opponentPlayer = (tmp);

	tmp = (game.curData);
	game.curData = (game.opponentData);
	game.opponentData = (tmp);
	PS.glyph(CTRL_OPTIONS.CUR_PLAYER.x, CTRL_PANEL_ROW, game.curPlayer.sideName);
	curSelectedBombPos = null;
	curSelectedShip = null;
}

function drawDefBead(x, y) {
	PS.glyph(x, y, "");
	PS.color(x, y, DEF_BEAD.color);
	PS.borderColor(x, y, DEF_BEAD.borderColor);
}

function insideGameGrid(x, y) {
	return x >= 0 && x < GAME_GRID_X_SZ && y >= 0 && y < GAME_GRID_Y_SZ;
}

function testMoveValid(ship, beadsAfterMove) {
	for (let bead of beadsAfterMove) {
		if (!insideGameGrid(bead.x, bead.y)
			|| (game.curData[bead.x][bead.y].state === BEAD_STATE.OCCUPIED &&
				game.curData[bead.x][bead.y].occupiedBy !== ship
			)) {
			return false;
		}
	}
	return true;
}

function getCtrlOptionFromPanelX(x) {
	for (let ctrlOpt of Object.values(CTRL_OPTIONS)) {
		if (ctrlOpt.x === x) {
			return ctrlOpt;
		}
	}
	return null;
}

function sleep(ms) {
	let st = new Date().getTime();
	while (new Date().getTime() < st + ms) { }
}

function debugValidate() {
	// go through every block to assure that curData's ship's sideName is 
	// no the same as opponentData's ship
	for (let i = 0; i < GAME_GRID_X_SZ; i++) {
		for (let j = 0; j < GAME_GRID_Y_SZ; j++) {
			if (game.curData[i][j].state === BEAD_STATE.OCCUPIED || game.curData[i][j].state === BEAD_STATE.HIT) {
				if (game.opponentData[i][j].state === BEAD_STATE.OCCUPIED || game.opponentData[i][j].state === BEAD_STATE.HIT) {
					if (game.curData[i][j].occupiedBy.sideName == game.opponentData[i][j].occupiedBy.sideName) {
						PS.debug("ship side same error at " + i + " " + j + "\n");
					}
				}
			}
		}
	}
}

// ----------------- event handlers -----------------

let handleShipSelect = function (x, y) {
	let data = game.curData[x][y];
	if (data.state === BEAD_STATE.OCCUPIED) {
		let ship = data.occupiedBy;
		if (curSelectedShip !== null) {
			// deselect the current selected ship
			curSelectedShip.toggleSelect();
			curSelectedShip.draw();
			curSelectedShip.updGrid(true, true);
		}
		ship.toggleSelect();
		if (ship.isSelected) {
			curSelectedShip = ship;
		}
		ship.draw();
		ship.updGrid(true, true);
	}
}


let checkGameEnd = function () {
	let isEnd = true;
	for (let s of game.opponentPlayer.ships) {
		if (!s.isSunk) {
			isEnd = false;
			break;
		}
	}
	if (isEnd) {
		PS.statusText(game.curPlayer.sideName + " won!!!");
		game.state = GAME_STATE.END;
	}
}

let handleCtrlOption = function (x, y) {
	if (x == CTRL_OPTIONS.ROTATE_CW.x || x == CTRL_OPTIONS.ROTATE_CCW.x) {
		if (curSelectedShip === null)
			return
		// check if it can rotate 
		let isCW = (x == CTRL_OPTIONS.ROTATE_CW.x);
		let beadsAfterRotate = curSelectedShip.getOccupiedBeadsAfterRotate(isCW);
		if (testMoveValid(curSelectedShip, beadsAfterRotate)) {
			curSelectedShip.drawRotate(isCW);
		}
	} else if (x == CTRL_OPTIONS.MOV_LEFT.x || x == CTRL_OPTIONS.MOV_RIGHT.x
		|| x == CTRL_OPTIONS.MOV_UP.x || x == CTRL_OPTIONS.MOV_DOWN.x) {
		if (curSelectedShip === null)
			return
		let move = getCtrlOptionFromPanelX(x).move;
		let beadsAfterMove = curSelectedShip.getOccupiedBeadsAfterMove(move);
		if (testMoveValid(curSelectedShip, beadsAfterMove)) {
			curSelectedShip.drawMove(move);
		}
	} else if (x == CTRL_OPTIONS.SUBMIT.x) {
		game.submitCnt++;
		let doRefresh = true;
		if (game.state == GAME_STATE.A_PLACING) {
			flipSide(true)
		} else if (game.state == GAME_STATE.B_PLACING) {
			game.state = GAME_STATE.A_ATTACKING;
			flipSide(false);
		}
		else {
			if (curSelectedBombPos === null)
				return;
			// attacking stage
			if (game.opponentData[curSelectedBombPos.x][curSelectedBombPos.y].state === BEAD_STATE.OCCUPIED) {
				let hittenOpponentShip = game.opponentData[curSelectedBombPos.x][curSelectedBombPos.y].occupiedBy;
				hittenOpponentShip.hit(curSelectedBombPos.x, curSelectedBombPos.y);
				if (hittenOpponentShip.isSunk) {
					for (let bead of hittenOpponentShip.getOccupiedBeads()) {
						PS.borderColor(bead.x, bead.y, SHIP_SUNK_COLOR);
						PS.color(bead.x, bead.y, SHIP_SUNK_COLOR);
					}
				} else
					for (let bead of hittenOpponentShip.getOccupiedBeads()) {
						if (game.opponentData[bead.x][bead.y].state === BEAD_STATE.HIT) {
							PS.color(bead.x, bead.y, SHIP_HIT_COLOR);
						}
					}
				doRefresh = false;
				// do a timer that wait for 30 ticks then refresh. 
				let tid = PS.timerStart(60, function () {
					refreshGameGrid();
					PS.timerStop(tid);
				});
			} else {
				game.opponentData[curSelectedBombPos.x][curSelectedBombPos.y].state = BEAD_STATE.BOMBED;
			}
			checkGameEnd();
			flipSide(false);
		}
		if (doRefresh)
			refreshGameGrid();
	}
}


let refreshGameGrid = function () {
	PS.debug("submit cnt: " + game.submitCnt + "\n");
	Debug.printBeadState();
	for (let i = 0; i < GAME_GRID_X_SZ; i++) {
		for (let j = 0; j < GAME_GRID_Y_SZ; j++) {
			drawDefBead(i, j);
			if (game.opponentData[i][j].state === BEAD_STATE.BOMBED) {
				PS.glyph(i, j, "X");
				PS.glyphColor(i, j, PS.COLOR_WHITE);
			}
			if (game.opponentData[i][j].state === BEAD_STATE.HIT) {
				PS.color(i, j, SHIP_HIT_COLOR);
			}
		}
	}
	debugValidate();
	if (game.isPlacing) {
		for (let s of game.curPlayer.ships) {
			s.draw();
			s.updGrid(true, true);
		}
	} else {
		for (let s of game.opponentPlayer.ships) {
			if (s.isSunk) {
				s.draw();
			}
		}
	}
}

let handleSelectAttack = function (x, y) {
	// cannot select previously hitten ships 
	debugValidate();
	if (game.opponentData[x][y].state === BEAD_STATE.HIT ||
		game.opponentData[x][y].state === BEAD_STATE.BOMBED) {
		return;
	}
	if (curSelectedBombPos !== null)
		if (game.opponentData[curSelectedBombPos.x][curSelectedBombPos.y].state === BEAD_STATE.HIT) {
			PS.color(curSelectedBombPos.x, curSelectedBombPos.y, SHIP_HIT_COLOR);
		} else {
			PS.color(curSelectedBombPos.x, curSelectedBombPos.y, DEF_BEAD.color);
		}
	PS.color(x, y, getContrastingColor(DEF_BEAD.color));
	curSelectedBombPos = { x: x, y: y };
}


// ----------------- PS funcs -----------------


PS.init = function (system, options) {

	PS.gridSize(GAME_GRID_X_SZ, GAME_GRID_Y_SZ + 1);
	for (let i = 0; i < GAME_GRID_X_SZ; i++) {
		PS.color(i, CTRL_PANEL_ROW, DEF_CTRL_BEAD.color);
		PS.borderColor(i, CTRL_PANEL_ROW, DEF_CTRL_BEAD.borderColor);
		PS.glyphColor(i, CTRL_PANEL_ROW, DEF_CTRL_BEAD.glyphColor);
	}

	for (let ctrlOpt of Object.values(CTRL_OPTIONS)) {
		PS.glyph(ctrlOpt.x, CTRL_PANEL_ROW, ctrlOpt.glyph);
	}
	refreshGameGrid();
	PS.statusText("battleship game");
}

PS.touch = function (x, y, data, options) {
	if (game.state == GAME_STATE.END) return;

	if (y != CTRL_PANEL_ROW && game.isPlacing)
		handleShipSelect(x, y);
	else if (y != CTRL_PANEL_ROW && !game.isPlacing)
		handleSelectAttack(x, y);
	else
		handleCtrlOption(x, y);
};

PS.release = function (x, y, data, options) {
};


PS.enter = function (x, y, data, options) {
};


PS.exit = function (x, y, data, options) {
	// Uncomment the following code line to inspect x/y parameters:

	// PS.debug( "PS.exit() @ " + x + ", " + y + "\n" );

	// Add code here for when the mouse cursor/touch exits a bead.
};


PS.exitGrid = function (options) {
	// Uncomment the following code line to verify operation:

	// PS.debug( "PS.exitGrid() called\n" );

	// Add code here for when the mouse cursor/touch moves off the grid.
};

PS.keyDown = function (key, shift, ctrl, options) {
	if (game.state == GAME_STATE.END) return;
	switch (key) {
		case 'w'.charCodeAt(0):
			handleCtrlOption(CTRL_OPTIONS.MOV_UP.x, CTRL_PANEL_ROW);
			break;
		case 'a'.charCodeAt(0):
			handleCtrlOption(CTRL_OPTIONS.MOV_LEFT.x, CTRL_PANEL_ROW);
			break;
		case 's'.charCodeAt(0):
			handleCtrlOption(CTRL_OPTIONS.MOV_DOWN.x, CTRL_PANEL_ROW);
			break;
		case 'd'.charCodeAt(0):
			handleCtrlOption(CTRL_OPTIONS.MOV_RIGHT.x, CTRL_PANEL_ROW);
			break;
		case 'q'.charCodeAt(0):
			handleCtrlOption(CTRL_OPTIONS.ROTATE_CCW.x, CTRL_PANEL_ROW);
			break;
		case 'e'.charCodeAt(0):
			handleCtrlOption(CTRL_OPTIONS.ROTATE_CW.x, CTRL_PANEL_ROW);
			break;
		case PS.KEY_ENTER:
			handleCtrlOption(CTRL_OPTIONS.SUBMIT.x, CTRL_PANEL_ROW);
			break;
	}
};

PS.keyUp = function (key, shift, ctrl, options) {
	// Uncomment the following code line to inspect first three parameters:

	// PS.debug( "PS.keyUp(): key=" + key + ", shift=" + shift + ", ctrl=" + ctrl + "\n" );

	// Add code here for when a key is released.
};

PS.input = function (sensors, options) {
};

