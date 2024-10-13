const GAS_TYPES: Record<
  number,
  { name: string; density: number; color: string }
> = {
  0: { name: "Empty", density: 0, color: "#ffffff" },
  1: { name: "Gas 1", density: 1, color: "#0000ff" },
  2: { name: "Gas 2", density: 2, color: "#00ff00" },
};

interface Cell {
  gasName: string;
  gasColor: string;
}

interface CellWithCoordinates {
  cell: Cell;
  x: number;
  y: number;
}

type Grid = CellWithCoordinates[];

class GridDisplay {
  private gridElement: HTMLElement;
  private grid: Grid;
  private width: number;
  private height: number;

  constructor(containerId: string, width: number, height: number) {
    this.gridElement = document.getElementById(containerId)!;
    this.grid = [];
    this.width = width;
    this.height = height;
    this.updateGrid();
    this.renderGrid();
  }

  private async renderGrid(): Promise<void> {
    this.gridElement.innerHTML = "";
    try {
      const response = await fetch("http://localhost:3000/grid");
      const grid = await response.json();
      this.grid = grid;
      for (let i = 0; i < this.height; i++) {
        const rowElement = document.createElement("div");
        rowElement.className = "row";
        const cellsInRow = this.grid.filter((cell) => cell.y === i);
        for (const cell of cellsInRow) {
          const cellElement = this.createCellElement(cell);
          rowElement.appendChild(cellElement);
        }
        this.gridElement.appendChild(rowElement);
      }
    } catch (error) {
      console.error("Error rendering grid:", error);
    }
  }

  private createCellElement(cell: CellWithCoordinates): HTMLElement {
    const element = document.createElement("div");
    element.className = "cell";
    element.style.backgroundColor = cell.cell.gasColor;
    element.dataset.x = cell.x.toString();
    element.dataset.y = cell.y.toString();
    return element;
  }

  updateCells(changes: Grid): void {
    for (const change of changes) {
      const { x, y, cell } = change;
      if (y >= 0 && y < this.grid.length) {
        this.grid.push({ cell, x, y });
        const cellElement = this.gridElement.querySelector(
          `[data-x="${x}"][data-y="${y}"]`
        );
        if (cellElement) {
          (cellElement as HTMLElement).style.backgroundColor = cell.gasColor;
        }
      }
    }
  }
  async updateGrid() {
    console.log("Updating grid", this.gridElement.children.length);
    const response = await fetchGridUpdate();

    if (response && response.length > 0) {
      const formattedResponse = response.map((cell) => ({
        x: cell.x,
        y: cell.y,
        cell: cell.cell,
      }));
      gridDisplay.updateCells(formattedResponse);
    } else {
      console.log("No changes in this update");
    }
  }
}

async function fetchGridUpdate(): Promise<Grid> {
  try {
    const response = await fetch("http://localhost:3000/simulate", {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching grid update:", error);
    return [];
  }
}

const GRID_WIDTH = 200;
const GRID_HEIGHT = 200;
const gridDisplay = new GridDisplay("grid-container", GRID_WIDTH, GRID_HEIGHT);

document.getElementById("reset-button")?.addEventListener("click", () => {
  fetch("http://localhost:3000/reset", { method: "POST" });
});

document.getElementById("refresh-button")?.addEventListener("click", () => {
  gridDisplay.updateGrid();
});
// // Update the grid every 100ms
// setInterval(updateGrid, 1000);
