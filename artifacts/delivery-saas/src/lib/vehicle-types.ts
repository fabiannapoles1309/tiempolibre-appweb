﻿export const VEHICLE_TYPES = [
  "Moto",
  "Bicicleta elÃ©ctrica",
  "Moto taxi",
  "Carro",
] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_TYPE_SET = new Set<string>(VEHICLE_TYPES);


