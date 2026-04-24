import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import zonesRouter from "./zones";
import driversRouter from "./drivers";
import ordersRouter from "./orders";
import financeRouter from "./finance";
import walletRouter from "./wallet";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(zonesRouter);
router.use(driversRouter);
router.use(ordersRouter);
router.use(financeRouter);
router.use(walletRouter);
router.use(reportsRouter);

export default router;
