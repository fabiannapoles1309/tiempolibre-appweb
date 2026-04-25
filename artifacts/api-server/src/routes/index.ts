import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import zonesRouter from "./zones";
import driversRouter from "./drivers";
import ordersRouter from "./orders";
import financeRouter from "./finance";
import walletRouter from "./wallet";
import reportsRouter from "./reports";
import incidentsRouter from "./incidents";
import subscriptionsRouter from "./subscriptions";
import financeExtraRouter from "./finance-extra";
import financeExportRouter from "./finance-export";
import benefitsTrackingRouter from "./benefits-tracking";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(zonesRouter);
router.use(driversRouter);
router.use(ordersRouter);
router.use(financeRouter);
router.use(walletRouter);
router.use(reportsRouter);
router.use(incidentsRouter);
router.use(subscriptionsRouter);
router.use(financeExtraRouter);
router.use(financeExportRouter);
router.use(benefitsTrackingRouter);
router.use(adminRouter);

export default router;
