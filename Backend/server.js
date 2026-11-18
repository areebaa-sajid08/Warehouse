import "dotenv/config";
import app from "./src/app.js";
import connectDB from "./src/db/db.js";

const port = process.env.PORT || 3000;

connectDB()
  .then(() => app.listen(port, () => console.log(`Server listening on port ${port}`)))
  .catch((error) => {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  });