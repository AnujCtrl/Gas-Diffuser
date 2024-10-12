// frontend/src/index.ts
interface Cell {
  gasType: number;
  density: number;
}

type Grid = Cell[][];

const GAS_TYPES: Record<number, { name: string; color: string }> = {
  0: { name: "Empty", color: "white" },
};

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
    element.style.backgroundColor = GAS_TYPES[cell.gasType].color;
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
setInterval(updateGrid, 1000);

// Initial update
updateGrid();
