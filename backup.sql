--
-- PostgreSQL database dump
--

\restrict ynC0TeHWNZpwaPIf0VYPmlUjdYcfx2IyuVtYqjVTcc6iRxCvEbrglt5tegVNe4q

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: benefit_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.benefit_claims (
    id integer NOT NULL,
    driver_id integer NOT NULL,
    benefit_item_id integer NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    delivered_at timestamp with time zone DEFAULT now() NOT NULL,
    delivered_by_user_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: benefit_claims_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.benefit_claims_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: benefit_claims_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.benefit_claims_id_seq OWNED BY public.benefit_claims.id;


--
-- Name: benefit_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.benefit_items (
    id integer NOT NULL,
    level integer NOT NULL,
    name character varying(96) NOT NULL,
    icon character varying(32) DEFAULT 'gift'::character varying NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: benefit_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.benefit_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: benefit_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.benefit_items_id_seq OWNED BY public.benefit_items.id;


--
-- Name: benefits_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.benefits_config (
    id integer NOT NULL,
    level integer NOT NULL,
    name character varying(64) NOT NULL,
    deliveries_required integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: benefits_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.benefits_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: benefits_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.benefits_config_id_seq OWNED BY public.benefits_config.id;


--
-- Name: customer_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    user_id integer NOT NULL,
    business_name character varying(255),
    pickup_address text,
    zone integer,
    phone character varying(64),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: driver_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.driver_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: drivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drivers (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(64) NOT NULL,
    vehicle character varying(64) NOT NULL,
    zones text[] DEFAULT '{}'::text[] NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id integer,
    license_plate character varying(16),
    circulation_card character varying(64),
    circulation_card_expiry date,
    status character varying(16) DEFAULT 'ACTIVO'::character varying NOT NULL,
    cash_pending numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    driver_code character varying(16)
);


--
-- Name: drivers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.drivers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: drivers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.drivers_id_seq OWNED BY public.drivers.id;


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(16) NOT NULL,
    subject character varying(255) NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feedback_id_seq OWNED BY public.feedback.id;


--
-- Name: incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidents (
    id integer NOT NULL,
    driver_id integer NOT NULL,
    order_id integer,
    type character varying(32) NOT NULL,
    description text NOT NULL,
    status character varying(16) DEFAULT 'ABIERTO'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: incidents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.incidents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incidents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.incidents_id_seq OWNED BY public.incidents.id;


--
-- Name: order_folio_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_folio_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    pickup text NOT NULL,
    delivery text NOT NULL,
    zone character varying(32),
    payment character varying(16) NOT NULL,
    amount numeric(12,2) NOT NULL,
    status character varying(16) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    driver_id integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    delivery_lat numeric(10,7),
    delivery_lng numeric(10,7),
    recipient_phone character varying(64),
    cash_amount numeric(12,2),
    cash_change numeric(12,2),
    recipient_name character varying(255),
    recipient_email character varying(255),
    subscription_id integer,
    folio character varying(16)
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: package_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    customer_id integer NOT NULL,
    status character varying(16) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    processed_by_user_id integer,
    processed_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: package_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.package_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: package_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.package_requests_id_seq OWNED BY public.package_requests.id;


--
-- Name: pricing_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_settings (
    key character varying(64) NOT NULL,
    value numeric(12,2) NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipients (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(64) NOT NULL,
    allow_marketing_sms boolean DEFAULT false NOT NULL,
    allow_marketing_email boolean DEFAULT false NOT NULL,
    order_count integer DEFAULT 0 NOT NULL,
    last_used_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email character varying(255)
);


--
-- Name: recipients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recipients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recipients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recipients_id_seq OWNED BY public.recipients.id;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    tier character varying(16) NOT NULL,
    monthly_price numeric(12,2) NOT NULL,
    monthly_deliveries integer NOT NULL,
    used_deliveries integer DEFAULT 0 NOT NULL,
    period_start timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(16) DEFAULT 'ACTIVA'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscriptions_id_seq OWNED BY public.subscriptions.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    order_id integer,
    amount numeric(12,2) NOT NULL,
    type character varying(16) NOT NULL,
    method character varying(16) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    password_hash text NOT NULL,
    role character varying(16) DEFAULT 'CLIENTE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    customer_code character varying(16)
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: wallet_tx; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_tx (
    id integer NOT NULL,
    user_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    type character varying(16) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wallet_tx_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wallet_tx_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wallet_tx_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wallet_tx_id_seq OWNED BY public.wallet_tx.id;


--
-- Name: wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallets (
    user_id integer NOT NULL,
    balance numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zones (
    id integer NOT NULL,
    name character varying(16) NOT NULL
);


--
-- Name: zones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.zones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: zones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.zones_id_seq OWNED BY public.zones.id;


--
-- Name: benefit_claims id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benefit_claims ALTER COLUMN id SET DEFAULT nextval('public.benefit_claims_id_seq'::regclass);


--
-- Name: benefit_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benefit_items ALTER COLUMN id SET DEFAULT nextval('public.benefit_items_id_seq'::regclass);


--
-- Name: benefits_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benefits_config ALTER COLUMN id SET DEFAULT nextval('public.benefits_config_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: drivers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers ALTER COLUMN id SET DEFAULT nextval('public.drivers_id_seq'::regclass);


--
-- Name: feedback id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback ALTER COLUMN id SET DEFAULT nextval('public.feedback_id_seq'::regclass);


--
-- Name: incidents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents ALTER COLUMN id SET DEFAULT nextval('public.incidents_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: package_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_requests ALTER COLUMN id SET DEFAULT nextval('public.package_requests_id_seq'::regclass);


--
-- Name: recipients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipients ALTER COLUMN id SET DEFAULT nextval('public.recipients_id_seq'::regclass);


--
-- Name: subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET DEFAULT nextval('public.subscriptions_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: wallet_tx id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_tx ALTER COLUMN id SET DEFAULT nextval('public.wallet_tx_id_seq'::regclass);


--
-- Name: zones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones ALTER COLUMN id SET DEFAULT nextval('public.zones_id_seq'::regclass);


--
-- Data for Name: benefit_claims; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.benefit_claims (id, driver_id, benefit_item_id, year, month, delivered_at, delivered_by_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: benefit_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.benefit_items (id, level, name, icon, description, created_at, updated_at) FROM stdin;
3	1	Vales de Gasolina	fuel	\N	2026-04-25 11:14:22.568283+00	2026-04-25 11:14:22.568283+00
\.


--
-- Data for Name: benefits_config; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.benefits_config (id, level, name, deliveries_required, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customers (id, user_id, business_name, pickup_address, zone, phone, created_at, updated_at) FROM stdin;
1	15	Negocio Test	Av. Reforma 123	5	+525555555555	2026-04-25 10:41:43.384808+00	2026-04-25 10:42:55.662+00
3	16	Cliente TL	CABA	\N	1111111111	2026-04-25 11:12:35.141608+00	2026-04-25 11:12:35.141608+00
4	18	cafe nirmata	bazar sur periferico 203	1	3333454565	2026-04-25 11:29:56.753438+00	2026-04-25 11:29:56.753438+00
5	6	Cliente Demo	Av. Vallarta 1234, Guadalajara	1	5512345678	2026-04-25 11:44:55.516655+00	2026-04-25 11:44:55.516655+00
6	21	\N	\N	\N	\N	2026-04-28 01:38:22.973782+00	2026-04-28 01:38:22.973782+00
\.


--
-- Data for Name: drivers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.drivers (id, name, phone, vehicle, zones, active, created_at, updated_at, user_id, license_plate, circulation_card, circulation_card_expiry, status, cash_pending, driver_code) FROM stdin;
2	Lucía Fernández	+54 11 5555-2020	Moto	{2,4}	t	2026-04-25 03:24:04.042652+00	2026-04-25 03:24:04.042652+00	\N	\N	\N	\N	ACTIVO	0.00	REP-000002
3	Javier Ruiz	+54 11 5555-3030	Carro	{5,6,7,8}	t	2026-04-25 03:24:04.047136+00	2026-04-25 03:24:04.047136+00	\N	\N	\N	\N	ACTIVO	0.00	REP-000003
4	Carlos Test 1777111025	099111222	Moto	{1}	t	2026-04-25 09:57:05.974469+00	2026-04-25 09:57:05.974469+00	13	\N	\N	\N	ACTIVO	0.00	REP-000004
5	Carlos Test 1777111067399	099111222	Moto	{1}	t	2026-04-25 09:58:51.02603+00	2026-04-25 09:58:51.02603+00	14	\N	\N	\N	ACTIVO	0.00	REP-000005
6	Driver		Moto	{}	t	2026-04-25 11:12:35.269145+00	2026-04-25 11:12:35.269145+00	17	\N	\N	\N	ACTIVO	0.00	REP-000006
7	Driver Test VT	+52 55 1234 5678	Moto taxi	{}	t	2026-04-25 13:23:25.088577+00	2026-04-25 13:23:25.088577+00	19	\N	\N	\N	ACTIVO	0.00	REP-000007
8	Repartidor Bici	+52 55 9999 0000	Bicicleta eléctrica	{1}	t	2026-04-25 13:24:43.838744+00	2026-04-25 13:24:43.838744+00	\N	\N	\N	\N	ACTIVO	0.00	REP-000008
9	Test Repartidor	3331112233	Moto	{1}	t	2026-04-28 01:38:22.821354+00	2026-04-28 01:38:22.821354+00	20	\N	\N	\N	ACTIVO	0.00	REP-000009
1	Carlos Gómez	+54 11 5555-1010	Carro	{1,3}	t	2026-04-25 03:24:04.037079+00	2026-04-28 01:49:28.824+00	7	\N	\N	\N	ACTIVO	3750.00	REP-000001
\.


--
-- Data for Name: feedback; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.feedback (id, user_id, type, subject, message, created_at) FROM stdin;
1	6	SUGERENCIA	Mejorar el mapa	Sería útil un filtro por zona en el mapa de envíos.	2026-04-25 13:13:58.860776+00
2	6	QUEJA	Repartidor llegó tarde	El repartidor llegó 45 minutos tarde a la entrega 123.	2026-04-25 13:16:43.883745+00
\.


--
-- Data for Name: incidents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.incidents (id, driver_id, order_id, type, description, status, created_at, updated_at) FROM stdin;
1	1	\N	DEMORA	Demora de 30 minutos por mucho tránsito en zona	EN_REVISION	2026-04-25 08:45:04.136077+00	2026-04-25 08:46:14.169+00
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orders (id, customer_id, pickup, delivery, zone, payment, amount, status, driver_id, notes, created_at, updated_at, delivery_lat, delivery_lng, recipient_phone, cash_amount, cash_change, recipient_name, recipient_email, subscription_id, folio) FROM stdin;
54	6	Av. Vallarta 1234, Guadalajara	Av Vallarta 1234, Guadalajara	1	EFECTIVO	0.00	ASIGNADO	8	\N	2026-04-28 01:32:30.596696+00	2026-04-28 01:39:22.511+00	20.6830700	-103.4358646	+52 33 1234 5678	200.00	50.00	Test Folio	\N	2	PED-000014
3	6	Av. Corrientes 1500, CABA	Av. Santa Fe 2000, CABA	1	BILLETERA	2800.00	ENTREGADO	1	\N	2026-04-25 03:24:04.07+00	2026-04-28 01:45:43.18+00	\N	\N	\N	\N	\N	\N	\N	\N	PED-000003
55	6	Av. Vallarta 1234, Guadalajara	CALLE RUBENS 3	1	EFECTIVO	0.00	ASIGNADO	4		2026-04-28 01:47:19.524203+00	2026-04-28 01:48:00.214+00	20.6731174	-103.4266835	333435546322	670.00	30.00	JUAN	juan@gmail.com	2	PED-000015
56	6	Av. Vallarta 1234, Guadalajara	DEL ORIENTE  23	1	EFECTIVO	0.00	PENDIENTE	\N		2026-04-28 01:49:05.076529+00	2026-04-28 01:49:05.076529+00	20.6821140	-103.4462532	3334545657	670.00	30.00	JUAN	uan@gmail.com	2	PED-000016
12	6	Av. Vallarta 1234, Guadalajara	Calle entrega prueba	1	EFECTIVO	0.00	ENTREGADO	1	\N	2026-04-25 12:21:16.810273+00	2026-04-28 01:49:28.822+00	20.6830700	-103.4358646	3312345678	250.00	250.00	María López	\N	\N	PED-000012
1	6	Av. Cabildo 1234, CABA	Av. Maipú 500, Olivos	1	EFECTIVO	3500.00	ENTREGADO	1	\N	2026-04-25 03:24:04.053+00	2026-04-25 11:44:10.306+00	\N	\N	\N	\N	\N	\N	\N	\N	PED-000001
2	6	Av. Rivadavia 8000, CABA	Calle Falsa 123, Flores	5	TRANSFERENCIA	4200.00	ASIGNADO	3	\N	2026-04-25 03:24:04.064+00	2026-04-25 03:49:17.781+00	\N	\N	\N	\N	\N	\N	\N	\N	PED-000002
4	6	Caseros 200, San Telmo	Belgrano 500, Boedo	2	EFECTIVO	5000.00	ENTREGADO	2	\N	2026-04-24 03:24:04.079+00	2026-04-25 03:24:04.080605+00	\N	\N	\N	\N	\N	\N	\N	\N	PED-000004
5	6	Av. Boedo 900, CABA	Pedro Goyena 1100, Caballito	4	TRANSFERENCIA	3200.00	ENTREGADO	2	\N	2026-04-23 03:24:04.086+00	2026-04-25 03:24:04.087306+00	\N	\N	\N	\N	\N	\N	\N	\N	PED-000005
6	6	Av. Pueyrredón 800, CABA	Av. Independencia 2200, CABA	3	EFECTIVO	2600.00	ENTREGADO	3	\N	2026-04-22 03:24:04.092+00	2026-04-25 03:24:04.093432+00	\N	\N	\N	\N	\N	\N	\N	\N	PED-000006
7	6	Av. Cordoba 4500, CABA	Honduras 5000, Palermo	1	BILLETERA	4800.00	ENTREGADO	1	\N	2026-04-21 03:24:04.099+00	2026-04-25 03:24:04.100229+00	\N	\N	\N	\N	\N	\N	\N	\N	PED-000007
8	6	Av. La Plata 1200, CABA	Av. Directorio 2000, CABA	6	EFECTIVO	3900.00	ENTREGADO	3	\N	2026-04-20 03:24:04.108+00	2026-04-25 03:24:04.110573+00	\N	\N	\N	\N	\N	\N	\N	\N	PED-000008
9	6	la calma 1	san pedro 3	\N	EFECTIVO	0.00	PENDIENTE	\N	casa verde 2do piso con juan  llamar por telefono 	2026-04-25 04:19:36.511569+00	2026-04-25 04:19:36.511569+00	\N	\N	\N	\N	\N	\N	\N	\N	PED-000009
10	6	Av. Vallarta 1234, Guadalajara	Calle entrega 123	1	EFECTIVO	250.00	ENTREGADO	1	\N	2026-04-25 12:04:21.950701+00	2026-04-25 12:05:14.7+00	20.6830700	-103.4358646	5512345678	250.00	\N	\N	\N	\N	PED-000010
11	6	Av. Vallarta 1234, Guadalajara	y	1	EFECTIVO	100.00	ASIGNADO	4	\N	2026-04-25 12:08:48.301561+00	2026-04-25 12:47:32.103+00	20.6830700	-103.4358646	5512345678	\N	\N	\N	\N	\N	PED-000011
21	6	Av. Vallarta 1234, Guadalajara	Av. Vallarta 1234, Guadalajara	1	EFECTIVO	1500.00	PENDIENTE	\N	\N	2026-04-25 13:51:34.116345+00	2026-04-25 13:51:34.116345+00	20.6830700	-103.4358646	+52 33 1234 5678	1500.00	0.00	Test	\N	2	PED-000013
\.


--
-- Data for Name: package_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.package_requests (id, user_id, customer_id, status, requested_at, processed_at, processed_by_user_id, processed_notes, created_at) FROM stdin;
1	6	5	APROBADA	2026-04-25 12:20:56.362062+00	2026-04-25 12:23:18.862+00	5	\N	2026-04-25 12:20:56.362062+00
7	6	5	APROBADA	2026-04-25 12:27:45.157541+00	2026-04-25 12:27:59.176+00	5	\N	2026-04-25 12:27:45.157541+00
12	6	5	APROBADA	2026-04-25 12:31:34.967807+00	2026-04-25 12:31:59.238+00	4	\N	2026-04-25 12:31:34.967807+00
\.


--
-- Data for Name: pricing_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pricing_settings (key, value, updated_at) FROM stdin;
ESTANDAR_PRICE	15000.00	2026-04-25 12:57:38.594722+00
OPTIMO_PRICE	25000.00	2026-04-25 12:57:38.594722+00
EXTRA_PACKAGE_PRICE	15000.00	2026-04-25 12:57:38.594722+00
\.


--
-- Data for Name: recipients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recipients (id, customer_id, name, phone, allow_marketing_sms, allow_marketing_email, order_count, last_used_at, created_at, updated_at, email) FROM stdin;
1	5	María López	3312345678	t	f	1	2026-04-25 12:21:16.814+00	2026-04-25 12:21:16.815154+00	2026-04-25 12:21:16.815154+00	\N
2	5	Test Folio	+52 33 1234 5678	f	f	10	2026-04-28 01:32:30.637+00	2026-04-25 13:34:53.644414+00	2026-04-28 01:32:30.637+00	\N
44	5	JUAN	333435546322	f	t	1	2026-04-28 01:47:19.562+00	2026-04-28 01:47:19.563251+00	2026-04-28 01:47:19.563251+00	juan@gmail.com
45	5	JUAN	3334545657	f	t	1	2026-04-28 01:49:05.109+00	2026-04-28 01:49:05.109998+00	2026-04-28 01:49:05.109998+00	uan@gmail.com
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subscriptions (id, user_id, tier, monthly_price, monthly_deliveries, used_deliveries, period_start, status, created_at, updated_at) FROM stdin;
3	11	ESTANDAR	15000.00	35	0	2026-04-25 09:30:10.047563+00	ACTIVA	2026-04-25 09:30:10.047563+00	2026-04-25 09:30:10.047563+00
4	12	ESTANDAR	15000.00	35	0	2026-04-25 09:33:41.396124+00	ACTIVA	2026-04-25 09:33:41.396124+00	2026-04-25 09:33:41.396124+00
5	15	ESTANDAR	15000.00	35	0	2026-04-25 10:41:43.389873+00	CANCELADA	2026-04-25 10:41:43.389873+00	2026-04-25 10:42:55.666+00
6	15	ESTANDAR	15000.00	105	0	2026-04-25 10:42:55.67142+00	ACTIVA	2026-04-25 10:42:55.67142+00	2026-04-25 11:13:58.394+00
7	18	ESTANDAR	15000.00	35	0	2026-04-25 11:29:56.757457+00	ACTIVA	2026-04-25 11:29:56.757457+00	2026-04-25 11:29:56.757457+00
1	6	ESTANDAR	15000.00	35	0	2026-04-25 08:42:58.284888+00	ACTIVA	2026-04-25 08:42:58.284888+00	2026-04-25 13:44:11.349+00
2	6	OPTIMO	25000.00	210	6	2026-04-25 08:45:33.535049+00	ACTIVA	2026-04-25 08:45:33.535049+00	2026-04-28 01:49:05.076+00
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transactions (id, order_id, amount, type, method, description, created_at) FROM stdin;
1	1	3500.00	INGRESO	EFECTIVO	Pedido #1	2026-04-25 03:24:04.053+00
2	2	4200.00	INGRESO	TRANSFERENCIA	Pedido #2	2026-04-25 03:24:04.064+00
3	3	2800.00	INGRESO	BILLETERA	Pedido #3	2026-04-25 03:24:04.07+00
4	4	5000.00	INGRESO	EFECTIVO	Pedido #4	2026-04-24 03:24:04.079+00
5	5	3200.00	INGRESO	TRANSFERENCIA	Pedido #5	2026-04-23 03:24:04.086+00
6	6	2600.00	INGRESO	EFECTIVO	Pedido #6	2026-04-22 03:24:04.092+00
7	7	4800.00	INGRESO	BILLETERA	Pedido #7	2026-04-21 03:24:04.099+00
8	8	3900.00	INGRESO	EFECTIVO	Pedido #8	2026-04-20 03:24:04.108+00
9	\N	200.00	INGRESO	EFECTIVO	Recarga billetera usuario #6	2026-04-25 04:09:49.97017+00
10	\N	100.00	INGRESO	TRANSFERENCIA	Recarga billetera usuario #6	2026-04-25 04:10:14.917349+00
11	9	0.00	INGRESO	EFECTIVO	Pedido #9	2026-04-25 04:19:36.554646+00
12	10	250.00	INGRESO	EFECTIVO	Pedido #10	2026-04-25 12:04:22.191542+00
13	11	100.00	INGRESO	EFECTIVO	Pedido #11	2026-04-25 12:08:48.306107+00
14	\N	100.00	INGRESO	TRANSFERENCIA	Recarga billetera usuario #5	2026-04-25 12:08:55.931513+00
15	12	0.00	INGRESO	EFECTIVO	Pedido #12	2026-04-25 12:21:16.82092+00
16	13	0.00	INGRESO	EFECTIVO	Pedido #13	2026-04-25 13:34:53.64929+00
17	14	0.00	INGRESO	EFECTIVO	Pedido #14	2026-04-25 13:34:53.778601+00
18	15	0.00	INGRESO	EFECTIVO	Pedido #15	2026-04-25 13:34:53.905042+00
19	16	0.00	INGRESO	EFECTIVO	Pedido #16	2026-04-25 13:36:44.592604+00
20	17	0.00	INGRESO	EFECTIVO	Pedido #17	2026-04-25 13:36:44.731238+00
21	18	0.00	INGRESO	EFECTIVO	Pedido #18	2026-04-25 13:44:10.84093+00
22	19	0.00	INGRESO	EFECTIVO	Pedido #19	2026-04-25 13:44:11.15524+00
23	20	0.00	INGRESO	EFECTIVO	Pedido #20	2026-04-25 13:44:11.255591+00
24	21	1500.00	INGRESO	EFECTIVO	Pedido #21	2026-04-25 13:51:34.162324+00
57	54	0.00	INGRESO	EFECTIVO	Pedido #54	2026-04-28 01:32:30.646575+00
58	55	0.00	INGRESO	EFECTIVO	Pedido #55	2026-04-28 01:47:19.583158+00
59	56	0.00	INGRESO	EFECTIVO	Pedido #56	2026-04-28 01:49:05.116621+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, name, password_hash, role, created_at, updated_at, customer_code) FROM stdin;
1	admin@rapidoo.com	Admin Rapidoo	$2b$10$0S/Eg7/ZYcUMuVmwg/mSUuXk36mIKy2TBtyTnYLTf1EloghCiuqV2	ADMIN	2026-04-24 04:46:05.583453+00	2026-04-24 04:46:05.583453+00	\N
3	driver@rapidoo.com	Carlos Gómez	$2b$10$38pagOAbK5VeoSmlwiX6EOtpn.a/FgCc7z04KzntCLs5oZfVzc7Me	DRIVER	2026-04-24 04:46:05.759034+00	2026-04-24 04:46:05.759034+00	\N
5	admin@tiempolibre.com	Admin TiempoLibre	$2b$10$DHnIHJl/Z/VkEfN0e3ee0OO0.O77r7i7tVRbgKJSQaM7EELnzQlja	ADMIN	2026-04-24 05:26:10.465768+00	2026-04-24 05:26:10.465768+00	\N
7	driver@tiempolibre.com	Carlos Gómez	$2b$10$zv4GiftwVHqGtjQ.lnmVjexITJfDbVxycXNbvbYVV.qFAzlCBXnAW	DRIVER	2026-04-24 05:26:10.654523+00	2026-04-24 05:26:10.654523+00	\N
4	fabian.napoles1309@gmail.com	Fabián Nápoles	$2b$10$UK4suQFIcjAnVjPcndfmS.6rQCjHCPBaa2G4w8f2qdEHY.sm.ck5e	SUPERUSER	2026-04-24 04:52:48.743107+00	2026-04-24 04:52:48.743107+00	\N
13	driver1777111025@test.com	Carlos Test 1777111025	$2b$10$gajLhdrHdUqkDaGwvKxNDuiqSOZU0.h5SkHk0Uw8pL3Q3CqAa3oVC	DRIVER	2026-04-25 09:57:05.751323+00	2026-04-25 09:57:05.751323+00	\N
14	driver.welcome.1777111067399@test.com	Carlos Test 1777111067399	$2b$10$nEV36z9dJRqUbyVl0HtS5ukeWsQKiWw.l4B3F1RT4hPI1WJk8Kaf6	DRIVER	2026-04-25 09:58:51.019437+00	2026-04-25 09:58:51.019437+00	\N
17	driver@tl.mx	Driver	$2b$10$L/.26hCfJ4r6BLfG1lO6eulTeAGKU99q3EcAw9pJ6lIwy5/Bl9zoq	DRIVER	2026-04-25 11:12:35.263905+00	2026-04-25 11:12:35.263905+00	\N
19	drivertest_vt_1777123397021@example.com	Driver Test VT	$2b$10$5V024t197iX82TO2qGigv.JB6bkpr42D8t3qr/rrCdTejVQqV71pe	DRIVER	2026-04-25 13:23:25.040361+00	2026-04-25 13:23:25.040361+00	\N
2	cliente@rapidoo.com	María Pérez	$2b$10$.kWHEnRVD9RLBIpgxU6UguNF0yV3XA8oguZd9H1rI44/1vdWl8klK	CLIENTE	2026-04-24 04:46:05.669917+00	2026-04-24 04:46:05.669917+00	CLI-000001
6	cliente@tiempolibre.com	María Pérez	$2b$10$64gvV44gcdy2SllenNUcIuinB2TCO8HIEmL94WM8g0f221YKwPiJa	CLIENTE	2026-04-24 05:26:10.555953+00	2026-04-24 05:26:10.555953+00	CLI-000002
11	cliente.e2e@example.com	Cliente Test E2E	$2b$10$5Avifgn6RqN062eGxc6SI.AAfxMLaKUG7igl0pinZqDFk9YiSBeyq	CLIENTE	2026-04-25 09:30:10.014777+00	2026-04-25 09:30:10.014777+00	CLI-000003
12	cliente.e2e+1777109563712@example.com	Cliente E2E	$2b$10$x/sN4BDHgdWhu04cYPUir.4YUWnkWXX6XhFMcf8e3VYL5hkvRxdeC	CLIENTE	2026-04-25 09:33:41.386657+00	2026-04-25 09:33:41.386657+00	CLI-000004
15	cliente-tl@test.com	Cliente TL	$2b$10$BMItVkpOwzrxq72eps.J5eAQ7A7E2XG.nKAapCFko9oelNUkzQlY2	CLIENTE	2026-04-25 10:41:43.345638+00	2026-04-25 10:42:55.623+00	CLI-000005
16	cliente@tl.mx	Cliente	$2b$10$ZghxqS2mmOO0O/LTcG9izumk9E.6RN8OangfQxYUQdFKEwT8sQ91G	CLIENTE	2026-04-25 11:12:35.100934+00	2026-04-25 11:12:35.100934+00	CLI-000006
18	nirmata@gmail.com	nirmata	$2b$10$8gfyGrC3veAEbJg0L1FPRedqRvypnaycOXBBva6/CRyzN64lh9wUi	CLIENTE	2026-04-25 11:29:56.715361+00	2026-04-25 11:29:56.715361+00	CLI-000007
20	testrep1777340302@tiempolibre.com	Test Repartidor	$2b$10$NxUm7XZWDtFIWtCedM6G4uyFbwHX5/3joyo2zPO3Y0xI/CZn61J4u	DRIVER	2026-04-28 01:38:22.777355+00	2026-04-28 01:38:22.777355+00	\N
21	testcli1777340302@tiempolibre.com	Test Cli	$2b$10$svhvhN9Op9F7jBkVf/LlVO9Ug.uAQuDDy8UwAzkN7KUp1D647IZv2	CLIENTE	2026-04-28 01:38:22.957893+00	2026-04-28 01:38:22.957893+00	CLI-000008
\.


--
-- Data for Name: wallet_tx; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wallet_tx (id, user_id, amount, type, description, created_at) FROM stdin;
1	6	200.00	TOPUP	Recarga vía EFECTIVO	2026-04-25 04:09:49.963255+00
2	6	100.00	TOPUP	Recarga vía TRANSFERENCIA	2026-04-25 04:10:14.913436+00
3	6	250.00	TOPUP	Cobranza en efectivo - Pedido #10	2026-04-25 12:05:14.698597+00
4	5	100.00	TOPUP	Recarga vía TRANSFERENCIA	2026-04-25 12:08:55.928362+00
8	6	250.00	TOPUP	Cobranza en efectivo - Pedido #12	2026-04-28 01:49:28.821989+00
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wallets (user_id, balance, updated_at) FROM stdin;
2	150.00	2026-04-24 04:46:05.673267+00
10	0.00	2026-04-25 08:16:29.478318+00
11	0.00	2026-04-25 09:30:10.040542+00
12	0.00	2026-04-25 09:33:41.39288+00
4	0.00	2026-04-25 10:18:22.640308+00
15	0.00	2026-04-25 10:41:43.380852+00
16	0.00	2026-04-25 11:12:35.135888+00
18	0.00	2026-04-25 11:29:56.74861+00
5	100.00	2026-04-25 12:08:55.923+00
21	0.00	2026-04-28 01:38:22.963946+00
6	950.00	2026-04-28 01:49:28.825+00
\.


--
-- Data for Name: zones; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.zones (id, name) FROM stdin;
1	1
2	2
3	3
4	4
5	5
6	6
7	7
8	8
\.


--
-- Name: benefit_claims_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.benefit_claims_id_seq', 1, false);


--
-- Name: benefit_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.benefit_items_id_seq', 3, true);


--
-- Name: benefits_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.benefits_config_id_seq', 1, false);


--
-- Name: customer_code_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customer_code_seq', 8, true);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customers_id_seq', 6, true);


--
-- Name: driver_code_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.driver_code_seq', 9, true);


--
-- Name: drivers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.drivers_id_seq', 9, true);


--
-- Name: feedback_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.feedback_id_seq', 2, true);


--
-- Name: incidents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.incidents_id_seq', 1, true);


--
-- Name: order_folio_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.order_folio_seq', 16, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.orders_id_seq', 56, true);


--
-- Name: package_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.package_requests_id_seq', 15, true);


--
-- Name: recipients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.recipients_id_seq', 45, true);


--
-- Name: subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.subscriptions_id_seq', 7, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.transactions_id_seq', 59, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 21, true);


--
-- Name: wallet_tx_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wallet_tx_id_seq', 8, true);


--
-- Name: zones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.zones_id_seq', 8, true);


--
-- Name: benefit_claims benefit_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benefit_claims
    ADD CONSTRAINT benefit_claims_pkey PRIMARY KEY (id);


--
-- Name: benefit_items benefit_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benefit_items
    ADD CONSTRAINT benefit_items_pkey PRIMARY KEY (id);


--
-- Name: benefits_config benefits_config_level_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benefits_config
    ADD CONSTRAINT benefits_config_level_unique UNIQUE (level);


--
-- Name: benefits_config benefits_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benefits_config
    ADD CONSTRAINT benefits_config_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_unique UNIQUE (user_id);


--
-- Name: drivers drivers_driver_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_driver_code_unique UNIQUE (driver_code);


--
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: orders orders_folio_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_folio_unique UNIQUE (folio);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: package_requests package_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_requests
    ADD CONSTRAINT package_requests_pkey PRIMARY KEY (id);


--
-- Name: pricing_settings pricing_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_settings
    ADD CONSTRAINT pricing_settings_pkey PRIMARY KEY (key);


--
-- Name: recipients recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipients
    ADD CONSTRAINT recipients_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: users users_customer_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_customer_code_unique UNIQUE (customer_code);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wallet_tx wallet_tx_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_tx
    ADD CONSTRAINT wallet_tx_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (user_id);


--
-- Name: zones zones_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_name_unique UNIQUE (name);


--
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- Name: benefit_claims_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX benefit_claims_unique_idx ON public.benefit_claims USING btree (driver_id, benefit_item_id, year, month);


--
-- Name: package_requests_one_pending_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX package_requests_one_pending_per_user ON public.package_requests USING btree (user_id) WHERE ((status)::text = 'PENDIENTE'::text);


--
-- Name: recipients_customer_phone_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX recipients_customer_phone_unique ON public.recipients USING btree (customer_id, phone);


--
-- Name: benefit_claims benefit_claims_benefit_item_id_benefit_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benefit_claims
    ADD CONSTRAINT benefit_claims_benefit_item_id_benefit_items_id_fk FOREIGN KEY (benefit_item_id) REFERENCES public.benefit_items(id) ON DELETE CASCADE;


--
-- Name: benefit_claims benefit_claims_delivered_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benefit_claims
    ADD CONSTRAINT benefit_claims_delivered_by_user_id_users_id_fk FOREIGN KEY (delivered_by_user_id) REFERENCES public.users(id);


--
-- Name: benefit_claims benefit_claims_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benefit_claims
    ADD CONSTRAINT benefit_claims_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;


--
-- Name: customers customers_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: drivers drivers_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: package_requests package_requests_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_requests
    ADD CONSTRAINT package_requests_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: package_requests package_requests_processed_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_requests
    ADD CONSTRAINT package_requests_processed_by_user_id_users_id_fk FOREIGN KEY (processed_by_user_id) REFERENCES public.users(id);


--
-- Name: package_requests package_requests_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_requests
    ADD CONSTRAINT package_requests_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: recipients recipients_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipients
    ADD CONSTRAINT recipients_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ynC0TeHWNZpwaPIf0VYPmlUjdYcfx2IyuVtYqjVTcc6iRxCvEbrglt5tegVNe4q

