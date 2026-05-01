import { db, usersTable, zonesTable, driversTable, ordersTable, walletsTable, transactionsTable, pricingSettingsTable, PRICING_KEYS, PRICING_DEFAULTS } from "@workspace/db";
import { hashPassword } from "./lib/auth";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Seeding base data...");

  // Zones â€” numeric 1-8
  const zoneNames = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  for (const name of zoneNames) {
    await db.insert(zonesTable).values({ name }).onConflictDoNothing();
  }

  // Pricing settings â€” defaults editables desde /admin/pricing-settings
  const pricingSeeds: Array<[string, number]> = [
    [PRICING_KEYS.ESTANDAR_PRICE, PRICING_DEFAULTS.ESTANDAR_PRICE],
    [PRICING_KEYS.OPTIMO_PRICE, PRICING_DEFAULTS.OPTIMO_PRICE],
    [PRICING_KEYS.EXTRA_PACKAGE_PRICE, PRICING_DEFAULTS.EXTRA_PACKAGE_PRICE],
  ];
  for (const [key, value] of pricingSeeds) {
    await db
      .insert(pricingSettingsTable)
      .values({ key, value: value.toFixed(2) })
      .onConflictDoNothing();
  }

  // Users
  const users = [
    { email: "fabian.napoles1309@gmail.com", name: "Fabián Nápoles", password: "Ikernapo2109", role: "SUPERUSER" },
    { email: "admin@tiempolibre.com", name: "Admin TiempoLibre", password: "admin123", role: "ADMIN" },
    { email: "cliente@tiempolibre.com", name: "María Pérez", password: "cliente123", role: "CLIENTE" },
    { email: "driver@tiempolibre.com", name: "Carlos Gómez", password: "driver123", role: "DRIVER" },
  ] as const;

  for (const u of users) {
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, u.email));
    if (existing.length === 0) {
      const hash = await hashPassword(u.password);
      const [created] = await db.insert(usersTable).values({
        email: u.email,
        name: u.name,
        passwordHash: hash,
        role: u.role,
      }).returning();
      if (created && u.role === "CLIENTE") {
        await db.insert(walletsTable).values({ userId: created.id, balance: "150.00" }).onConflictDoNothing();
      }
      console.log(`  + Usuario: ${u.email}`);
    }
  }

  const [cliente] = await db.select().from(usersTable).where(eq(usersTable.email, "cliente@tiempolibre.com"));
  const [driverUser] = await db.select().from(usersTable).where(eq(usersTable.email, "driver@tiempolibre.com"));

  // Drivers â€” Carlos linked to driver user; zones use numeric strings
  const driverSeeds: Array<{ name: string; phone: string; vehicle: string; zones: string[]; userId: number | null }> = [
    { name: "Carlos Gómez", phone: "+54 11 5555-1010", vehicle: "Moto Honda 150", zones: ["1", "3"], userId: driverUser?.id ?? null },
    { name: "Lucía Fernández", phone: "+54 11 5555-2020", vehicle: "Moto Yamaha", zones: ["2", "4"], userId: null },
    { name: "Javier Ruiz", phone: "+54 11 5555-3030", vehicle: "Furgoneta", zones: ["5", "6", "7", "8"], userId: null },
  ];
  for (const d of driverSeeds) {
    const existing = await db.select().from(driversTable).where(eq(driversTable.name, d.name));
    if (existing.length === 0) {
      await db.insert(driversTable).values({ ...d, active: true });
      console.log(`  + Driver: ${d.name}`);
    } else if (d.userId && existing[0] && existing[0].userId !== d.userId) {
      // Link existing driver row to its user account
      await db.update(driversTable)
        .set({ userId: d.userId, zones: d.zones })
        .where(eq(driversTable.id, existing[0].id));
      console.log(`  ~ Driver ${d.name} linked to user ${d.userId}`);
    }
  }

  // Sample orders for the customer
  if (cliente) {
    const existingOrders = await db.select().from(ordersTable).where(eq(ordersTable.customerId, cliente.id));
    if (existingOrders.length === 0) {
      const drivers = await db.select().from(driversTable);
      const samples = [
        { pickup: "Av. Cabildo 1234, CABA", delivery: "Av. Maipú 500, Olivos", zone: "1", payment: "EFECTIVO", amount: "3500", status: "PENDIENTE", driverId: null, daysAgo: 0 },
        { pickup: "Av. Rivadavia 8000, CABA", delivery: "Calle Falsa 123, Flores", zone: "5", payment: "TRANSFERENCIA", amount: "4200", status: "PENDIENTE", driverId: null, daysAgo: 0 },
        { pickup: "Av. Corrientes 1500, CABA", delivery: "Av. Santa Fe 2000, CABA", zone: "1", payment: "BILLETERA", amount: "2800", status: "EN_RUTA", driverId: drivers[0]?.id ?? null, daysAgo: 0 },
        { pickup: "Caseros 200, San Telmo", delivery: "Belgrano 500, Boedo", zone: "2", payment: "EFECTIVO", amount: "5000", status: "ENTREGADO", driverId: drivers[1]?.id ?? null, daysAgo: 1 },
        { pickup: "Av. Boedo 900, CABA", delivery: "Pedro Goyena 1100, Caballito", zone: "4", payment: "TRANSFERENCIA", amount: "3200", status: "ENTREGADO", driverId: drivers[1]?.id ?? null, daysAgo: 2 },
        { pickup: "Av. Pueyrredón 800, CABA", delivery: "Av. Independencia 2200, CABA", zone: "3", payment: "EFECTIVO", amount: "2600", status: "ENTREGADO", driverId: drivers[2]?.id ?? null, daysAgo: 3 },
        { pickup: "Av. Cordoba 4500, CABA", delivery: "Honduras 5000, Palermo", zone: "1", payment: "BILLETERA", amount: "4800", status: "ENTREGADO", driverId: drivers[0]?.id ?? null, daysAgo: 4 },
        { pickup: "Av. La Plata 1200, CABA", delivery: "Av. Directorio 2000, CABA", zone: "6", payment: "EFECTIVO", amount: "3900", status: "ENTREGADO", driverId: drivers[2]?.id ?? null, daysAgo: 5 },
        { pickup: "Av. Reforma 100, CDMX", delivery: "Polanco 50, CDMX", zone: "1", payment: "TARJETA", amount: "4500", status: "ENTREGADO", driverId: drivers[0]?.id ?? null, daysAgo: 1 },
        { pickup: "Av. Insurgentes 800, CDMX", delivery: "Roma Norte 300, CDMX", zone: "2", payment: "TARJETA", amount: "3700", status: "ENTREGADO", driverId: drivers[1]?.id ?? null, daysAgo: 2 },
        { pickup: "Centro 100, CDMX", delivery: "Condesa 200, CDMX", zone: "3", payment: "CORTESIA", amount: "0", status: "ENTREGADO", driverId: drivers[2]?.id ?? null, daysAgo: 1 },
        { pickup: "Coyoacán 50, CDMX", delivery: "San Ãngel 150, CDMX", zone: "4", payment: "CORTESIA", amount: "0", status: "ENTREGADO", driverId: drivers[0]?.id ?? null, daysAgo: 3 },
      ];
      for (const s of samples) {
        const created = new Date();
        created.setDate(created.getDate() - s.daysAgo);
        const [order] = await db.insert(ordersTable).values({
          customerId: cliente.id,
          pickup: s.pickup,
          delivery: s.delivery,
          zone: s.zone,
          payment: s.payment,
          amount: s.amount,
          status: s.status,
          driverId: s.driverId,
          createdAt: created,
        }).returning();
        if (order) {
          await db.insert(transactionsTable).values({
            orderId: order.id,
            amount: s.amount,
            type: "INGRESO",
            method: s.payment,
            description: `Pedido #${order.id}`,
            createdAt: created,
          });
        }
      }
      console.log(`  + ${samples.length} pedidos sembrados`);
    }
  }

  console.log("Seed completado.");
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
