// backend/src/index.ts
import express from "express";
import { createClient } from "redis";
import cors from "cors";
import winston from "winston";

// Create Winston logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    // new winston.transports.File({ filename: "error.log", level: "error" }),
    // new winston.transports.File({ filename: "combined.log" }),
  ],
});

const app = express();
const redis = createClient({
  url: "redis://127.0.0.1:6379",
});

redis.on("error", (err) => logger.error("Redis Client Error", { error: err }));

app.use(cors());
app.use(express.json());

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

const GAS_TYPES: Record<
  number,
  { name: string; density: number; color: string }
> = {
  0: { name: "Empty", density: 0, color: "#ffffff" },
  1: { name: "Gas 1", density: 1, color: "#0000ff" },
  2: { name: "Gas 2", density: 2, color: "#00ff00" },
  3: { name: "Gas 3", density: 3, color: "#ff0000" },
  4: { name: "Gas 4", density: 4, color: "#00ffff" },
  5: { name: "Gas 5", density: 5, color: "#ff00ff" },
  // 6: { name: "Gas 6", density: 6, color: "#ffff00" },
  // 7: { name: "Gas 7", density: 7, color: "#ffa500" },
  // 8: { name: "Gas 8", density: 8, color: "#800080" },
  // 9: { name: "Gas 9", density: 9, color: "#008000" },
  // 10: { name: "Gas 10", density: 10, color: "#800000" },
};

async function getGridFromRedis(): Promise<Grid> {
  const gridJson = await redis.get("gasGrid");
  return gridJson ? JSON.parse(gridJson) : createGrid(200, 200);
}

async function saveGridToRedis(grid: Grid): Promise<void> {
  await redis.set("gasGrid", JSON.stringify(grid));
}

async function clearRedis() {
  try {
    await redis.flushAll();
    logger.info("Redis cache cleared");
  } catch (error) {
    logger.error("Failed to clear Redis cache", { error });
  }
}

async function connectToRedis() {
  if (!redis.isOpen) {
    await redis.connect();
    logger.info("Connected to Redis");
    await clearRedis();
  }
}

connectToRedis()
  .then(() => {
    // Start the server only after Redis is connected and cleared
    const PORT = 3000;
    app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
  })
  .catch((error) => logger.error("Failed to connect to Redis", { error }));

app.get("/grid", async (req, res) => {
  try {
    const grid = await getGridFromRedis();
    console.log(grid);
    res.json(grid);
    logger.info("Grid sent to client");
  } catch (error) {
    logger.error("Error fetching grid", { error });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/simulate", async (req, res) => {
  try {
    let grid = await getGridFromRedis();
    logger.info("Simulating grid", { length: grid.length });
    let newGrid = simulateGrid(grid);
    let onlyChanges = getChanges(grid, newGrid);
    logger.info("Changes", { length: onlyChanges.length });
    await saveGridToRedis(newGrid);
    res.json(onlyChanges.length > 0 ? onlyChanges : grid);
  } catch (error) {
    logger.error("Error during simulation", { error });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/reset", async (req, res) => {
  await clearRedis();
  res.json({ message: "Redis cache cleared" });
});

function getGasTypeDensity(gasName: string): number {
  const gasTypeEntry = Object.entries(GAS_TYPES).find(
    ([_, value]) => value.name === gasName
  );
  return gasTypeEntry ? gasTypeEntry[1].density : 0;
}

function simulateGrid(grid: Grid): Grid {
  for (let i = 0; i < grid.length; i++) {
    const cellWithCoords = grid[i];
    const cellDensity = getGasTypeDensity(cellWithCoords.cell.gasName);
    const aboveDensity = grid.find((row) => row.y === cellWithCoords.y - 1)
      ?.cell.gasName;
    const belowDensity = grid.find((row) => row.y === cellWithCoords.y + 1)
      ?.cell.gasName;
    if (aboveDensity && getGasTypeDensity(aboveDensity) > cellDensity) {
      grid[i].y = grid[i].y - 1;
    }
    if (belowDensity && getGasTypeDensity(belowDensity) < cellDensity) {
      grid[i].y = grid[i].y + 1;
    }
  }

  return grid;
}

function createGrid(width: number, height: number): Grid {
  const grid: Grid = [];
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const gasTypeIndex = Math.floor(
        Math.random() * Object.keys(GAS_TYPES).length
      );
      const gasType = GAS_TYPES[gasTypeIndex];
      grid.push({
        cell: { gasName: gasType.name, gasColor: gasType.color },
        x: i,
        y: j,
      });
    }
  }
  return grid;
}

function getChanges(oldGrid: Grid, newGrid: Grid): CellWithCoordinates[] {
  const changes: CellWithCoordinates[] = [];
  console.log(oldGrid.length, newGrid.length);
  if (oldGrid.length !== newGrid.length) {
    return newGrid;
  }
  for (let i = 0; i < oldGrid.length; i++) {
    if (oldGrid[i].y !== newGrid[i].y) {
      changes.push(newGrid[i]);
    }
  }
  return changes;
}
