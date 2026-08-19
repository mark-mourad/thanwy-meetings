import { Router, type IRouter } from "express";
import healthRouter from "./health";
import thanwyRouter from "./thanwy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(thanwyRouter);

export default router;
