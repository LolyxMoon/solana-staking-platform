import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// --- Existing routes (if you had any) go here ---

// ✅ Test /projects route
app.get("/projects", (req, res) => {
  res.json([
    {
      id: 1,
      name: "Solana Fixed Staking Pool",
      description: "Stake SOL for 30 days at a fixed 8% APR.",
      apy: "8%",
      type: "Fixed",
    },
    {
      id: 2,
      name: "Variable Reward Pool",
      description: "Flexible staking with rewards based on network fees.",
      apy: "5-12%",
      type: "Variable",
    }
  ]);
});

// ✅ Start server
const PORT = 4000;
app.get("/ping", (req, res) => {
  res.json({ message: "pong" });
});
app.listen(PORT, () => {
  console.log(`admin server running on :${PORT}`);
});
