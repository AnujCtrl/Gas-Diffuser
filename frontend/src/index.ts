// frontend/src/index.ts
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

type Grid = Cell[][];

class GridDisplay {
  private gridElement: HTMLElement;

  constructor(containerId: string) {
    this.gridElement = document.getElementById(containerId)!;
  }

  updateGrid(grid: Grid): void {
    this.gridElement.innerHTML = "";
    for (const row of grid) {
      const rowElement = document.createElement("div");
      rowElement.className = "row";
      for (const cell of row) {
        const cellElement = this.createCellElement(cell);
        rowElement.appendChild(cellElement);
      }
      this.gridElement.appendChild(rowElement);
    }
  }

  private createCellElement(cell: Cell): HTMLElement {
    const element = document.createElement("div");
    element.className = "cell";
    element.style.backgroundColor = cell.gasColor;
    return element;
  }
}

async function fetchGridUpdate(): Promise<Grid> {
  const response = await fetch("http://localhost:3000/simulate", {
    method: "POST",
  });
  return response.json();
}

const gridDisplay = new GridDisplay("grid-container");

async function updateGrid() {
  const newGrid = await fetchGridUpdate();
  gridDisplay.updateGrid(newGrid);
}

// Update the grid every second
setInterval(updateGrid, 100);

// Initial update
updateGrid();

document.getElementById("reset-button")?.addEventListener("click", () => {
  fetch("http://localhost:3000/reset", { method: "POST" });
});
