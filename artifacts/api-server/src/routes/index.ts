import marketingRouter from './marketing';
import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import zonesRouter from "./zones";
import driversRouter from "./drivers";
import ordersRouter from "./orders";
import financeRouter from "./finance";
import walletRouter from "./wallet";
import incidentsRouter from "./incidents";
import subscriptionsRouter from "./subscriptions";
import financeExtraRouter from "./finance-extra";
import financeExportRouter from "./finance-export";
import benefitsTrackingRouter from "./benefits-tracking";
import adminRouter from "./admin";
import recipientsRouter from "./recipients";
import packageRequestsRouter from "./package-requests";
import pricingSettingsRouter from "./pricing-settings";
import staffUsersRouter from "./staff-users";
import combinedReportRouter from "./combined-report";
import feedbackRouter from "./feedback";
import notificationsRouter from "./notifications";

// --- Nuevas Rutas (Tiempo Libre) ---
import { driverStatusRouter } from "./driverStatus";
import { deliveryTimerRouter } from "./deliveryTimer";
import { refundsRouter } from "./refunds";
import { messagingRouter } from "./messaging";
import reportsRouter from "./reports";
import { shippingCostsRouter } from "./shippingCosts";

const router: IRouter = Router();

// Rutas originales
router.use(healthRouter);
router.use(authRouter);
router.use(zonesRouter);
router.use(driversRouter);
router.use(ordersRouter);
router.use(financeRouter);
router.use(walletRouter);
router.use(incidentsRouter);
router.use(subscriptionsRouter);
router.use(financeExtraRouter);
router.use(financeExportRouter);
router.use(benefitsTrackingRouter);
router.use(adminRouter);
router.use(recipientsRouter);
router.use(packageRequestsRouter);
router.use(pricingSettingsRouter);
router.use(staffUsersRouter);
router.use(combinedReportRouter);
router.use(feedbackRouter);
router.use(notificationsRouter);

// Nuevas rutas conectadas a los endpoints correctos
router.use("/driver", driverStatusRouter);
router.use("/orders", deliveryTimerRouter);
router.use("/admin/refunds", refundsRouter);
router.use("/admin/messaging", messagingRouter);
router.use("/admin/reports", reportsRouter);
router.use("/reports", reportsRouter);
router.use("/admin/shipping-costs", shippingCostsRouter);

router.use('/marketing', marketingRouter);
export default router;






