import { db, usersTable, zonesTable, driversTable, ordersTable, walletsTable, transactionsTable } from "@workspace/db";
import { hashPassword } from "./lib/auth";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Seeding base data...");

  // Zones
  const zoneNames = ["Norte", "Sur", "Este", "Oeste"];
  for (const name of zoneNames) {
    await db.insert(zonesTable).values({ name }).onConflictDoNothing();
  }

  // Users
  const users = [
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

  // Drivers
  const driverSeeds = [
    { name: "Carlos Gómez", phone: "+54 11 5555-1010", vehicle: "Moto Honda 150", zones: ["Norte", "Este"] },
    { name: "Lucía Fernández", phone: "+54 11 5555-2020", vehicle: "Moto Yamaha", zones: ["Sur", "Oeste"] },
    { name: "Javier Ruiz", phone: "+54 11 5555-3030", vehicle: "Furgoneta", zones: ["Norte", "Sur", "Este", "Oeste"] },
  ];
  for (const d of driverSeeds) {
    const existing = await db.select().from(driversTable).where(eq(driversTable.name, d.name));
    if (existing.length === 0) {
      await db.insert(driversTable).values({ ...d, active: true });
      console.log(`  + Driver: ${d.name}`);
    }
  }

  // Sample orders for the customer
  if (cliente) {
    const existingOrders = await db.select().from(ordersTable).where(eq(ordersTable.customerId, cliente.id));
    if (existingOrders.length === 0) {
      const drivers = await db.select().from(driversTable);
      const samples = [
        { pickup: "Av. Cabildo 1234, CABA", delivery: "Av. Maipú 500, Olivos", zone: "Norte", payment: "EFECTIVO", amount: "3500", status: "PENDIENTE", driverId: null, daysAgo: 0 },
        { pickup: "Av. Rivadavia 8000, CABA", delivery: "Calle Falsa 123, Flores", zone: "Oeste", payment: "TRANSFERENCIA", amount: "4200", status: "PENDIENTE", driverId: null, daysAgo: 0 },
        { pickup: "Av. Corrientes 1500, CABA", delivery: "Av. Santa Fe 2000, CABA", zone: "Norte", payment: "BILLETERA", amount: "2800", status: "EN_RUTA", driverId: drivers[0]?.id ?? null, daysAgo: 0 },
        { pickup: "Caseros 200, San Telmo", delivery: "Belgrano 500, Boedo", zone: "Sur", payment: "EFECTIVO", amount: "5000", status: "ENTREGADO", driverId: drivers[1]?.id ?? null, daysAgo: 1 },
        { pickup: "Av. Boedo 900, CABA", delivery: "Pedro Goyena 1100, Caballito", zone: "Sur", payment: "TRANSFERENCIA", amount: "3200", status: "ENTREGADO", driverId: drivers[1]?.id ?? null, daysAgo: 2 },
        { pickup: "Av. Pueyrredón 800, CABA", delivery: "Av. Independencia 2200, CABA", zone: "Este", payment: "EFECTIVO", amount: "2600", status: "ENTREGADO", driverId: drivers[2]?.id ?? null, daysAgo: 3 },
        { pickup: "Av. Cordoba 4500, CABA", delivery: "Honduras 5000, Palermo", zone: "Norte", payment: "BILLETERA", amount: "4800", status: "ENTREGADO", driverId: drivers[0]?.id ?? null, daysAgo: 4 },
        { pickup: "Av. La Plata 1200, CABA", delivery: "Av. Directorio 2000, CABA", zone: "Oeste", payment: "EFECTIVO", amount: "3900", status: "ENTREGADO", driverId: drivers[2]?.id ?? null, daysAgo: 5 },
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
