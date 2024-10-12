// backend/src/index.ts
import express from "express";
import { createClient } from "redis";
import cors from "cors";
import winston from "winston";

// Create Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
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
  gasType: number;
  density: number;
}

type Grid = Cell[][];

const GAS_TYPES: Record<
  number,
  { name: string; density: number; color: string }
> = {
  0: { name: "Empty", density: 0, color: "white" },
};

function createGrid(width: number, height: number): Grid {
  return Array(height)
    .fill(null)
    .map(() =>
      Array(width)
        .fill(null)
        .map(() => ({ gasType: 0, density: 0 }))
    );
}

async function getGridFromRedis(): Promise<Grid> {
  const gridJson = await redis.get("gasGrid");
  return gridJson ? JSON.parse(gridJson) : createGrid(50, 50);
}

async function saveGridToRedis(grid: Grid): Promise<void> {
  await redis.set("gasGrid", JSON.stringify(grid));
}

async function connectToRedis() {
  if (!redis.isOpen) {
    await redis.connect();
    logger.info("Connected to Redis");
  }
}

connectToRedis().catch((error) => logger.error("Failed to connect to Redis", { error }));

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
    // For now, we're not changing the grid, just sending it back
    await saveGridToRedis(grid);
    res.json(grid);
    logger.info("Simulation completed and grid sent back");
  } catch (error) {
    logger.error("Error during simulation", { error });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = 3000;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
