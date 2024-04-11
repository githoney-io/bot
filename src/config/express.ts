import express from "express";
import morgan from "morgan";
import cors from "cors";


// Initialize the express engine
const createServer = () => {
  const app: express.Application = express();

  app.use(express.urlencoded({ extended: true }));
  app.use(cors());
  app.use(express.json());
  app.use(morgan("dev"));

  return app;
};

export default createServer;
