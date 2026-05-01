import { pgTable, serial, text, varchar, timestamp, integer, json, date } from "drizzle-orm/pg-core";

export const communityPosts = pgTable("community_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  url: text("url"),
  type: varchar("type", { length: 50 }),
  network: varchar("network", { length: 50 }),
  status: varchar("status", { length: 50 }).default('ACTIVE'),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  qrData: text("qr_data"),
  discountType: varchar("discount_type", { length: 50 }),
  discountValue: integer("discount_value"),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  usedCount: integer("used_count").default(0),
  maxUses: integer("max_uses"),
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  cliente: text("cliente"),
  descripcion: text("descripcion"),
  urls: json("urls"),
  estado: varchar("estado", { length: 50 }).default('ACTIVE'),
  fechaInicio: date("fecha_inicio"),
  fechaFin: date("fecha_fin"),
  views: integer("views").default(0),
  interacciones: integer("interacciones").default(0),
  createdBy: text("created_by"),
});

export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  prospecto: text("prospecto"),
  empresa: text("empresa"),
  canales: json("canales"),
  objetivo: text("objetivo"),
  presupuesto: integer("presupuesto"),
  notas: text("notas"),
  estado: varchar("estado", { length: 50 }).default('PENDING'),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const marketingClientes = pgTable("marketing_clientes", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  empresa: text("empresa"),
  giro: text("giro"),
  email: text("email"),
  telefono: varchar("telefono", { length: 50 }),
  estado: varchar("estado", { length: 50 }).default('ACTIVE'),
  campanas: integer("campanas").default(0),
  fechaAlta: timestamp("fecha_alta").defaultNow(),
  notas: text("notas"),
  createdBy: text("created_by"),
});

export const marketingMessages = pgTable("marketing_messages", {
  id: serial("id").primaryKey(),
  titulo: text("titulo").notNull(),
  contenido: text("contenido"),
  canal: varchar("canal", { length: 50 }),
  audiencia: text("audiencia"),
  destinatarios: integer("destinatarios").default(0),
  estado: varchar("estado", { length: 50 }).default('DRAFT'),
  fecha: timestamp("fecha").defaultNow(),
  createdBy: text("created_by"),
});

export const marketingMetrics = pgTable("marketing_metrics", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id"),
  views: integer("views").default(0),
  interacciones: integer("interacciones").default(0),
  clicks: integer("clicks").default(0),
  compartidos: integer("compartidos").default(0),
  periodo: text("periodo"),
  updatedBy: text("updated_by"),
});
