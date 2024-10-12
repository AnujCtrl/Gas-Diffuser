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

type Grid = Cell[][];

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

function createGrid(width: number, height: number): Grid {
  return Array(height)
    .fill(null)
    .map(() =>
      Array(width)
        .fill(null)
        .map(() => {
          const gasTypeIndex = Math.floor(
            Math.random() * Object.keys(GAS_TYPES).length
          );
          const gasType = GAS_TYPES[gasTypeIndex];
          return {
            gasName: gasType.name,
            gasColor: gasType.color,
          };
        })
    );
}

async function getGridFromRedis(): Promise<Grid> {
  const gridJson = await redis.get("gasGrid");
  return gridJson ? JSON.parse(gridJson) : createGrid(100, 100);
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
    grid = simulateGrid(grid);
    await saveGridToRedis(grid);
    res.json(grid);
    logger.debug("Simulation completed and grid sent back");
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
  const newGrid = JSON.parse(JSON.stringify(grid)); // Create a deep copy of the grid

  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[i].length; j++) {
      const cell = grid[i][j];
      const cellDensity = getGasTypeDensity(cell.gasName);
      const aboveDensity = getGasTypeDensity(grid[i - 1]?.[j]?.gasName);
      const belowDensity = getGasTypeDensity(grid[i + 1]?.[j]?.gasName);

      if (i > 0 && aboveDensity > cellDensity) {
        if (Math.random() < 0.5 || true) {
          newGrid[i][j] = grid[i - 1][j];
          newGrid[i - 1][j] = cell;
        }
      } else if (i < grid.length - 1 && belowDensity < cellDensity) {
        if (Math.random() < 0.5 || true) {
          newGrid[i][j] = grid[i + 1][j];
          newGrid[i + 1][j] = cell;
        }
      }
    }
  }

  return newGrid;
}
