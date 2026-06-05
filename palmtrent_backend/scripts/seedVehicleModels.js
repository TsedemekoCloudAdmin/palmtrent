require('dotenv').config();
const mongoose = require('mongoose');
const VehicleMake = require('../models/VehicleMake');
const VehicleModel = require('../models/VehicleModel');
const VehicleType = require('../models/VehicleType');

const vehicleModelSeedData = [
  {
    make: 'Honda',
    country: 'Japan',
    isPopular: true,
    models: [
      { name: 'Fit', variants: ['Fit', 'Fit Hybrid', 'RS'], types: ['Compact Hatchback'] },
      { name: 'Grace', variants: ['Hybrid', 'LX', 'EX'], types: ['Sedan'] },
      { name: 'Freed', variants: ['Hybrid', 'G', 'Spike'], types: ['MPV / People Carrier'] },
      { name: 'Vezel', variants: ['Hybrid', 'X', 'Z'], types: ['Compact SUV / Crossover'] },
      { name: 'CR-V', variants: ['LX', 'EX', 'Executive'], types: ['Compact SUV / Crossover'] }
    ]
  },
  {
    make: 'Hino',
    country: 'Japan',
    models: [
      { name: '200 Series', variants: ['Hino 200', '3.8t GVW'], types: ['3-Tonne Truck'] },
      { name: '300 Series', variants: ['300 614', '300 616', '300 714', '300 816'], types: ['3-Tonne Truck', '5-Tonne Truck'] },
      { name: '500 Series', variants: ['500 1322', '500 1626', '500 1727', '500 2628'], types: ['7-Tonne Truck', '10-Tonne Truck', '15-Tonne Truck', 'Flatbed Truck (10-Tonne)'] },
      { name: '700 Series', variants: ['700 2841', '700 2845 TT', '700 SS', '700 FS'], types: ['Truck Tractor (Horse Only)', 'Interlink (34-Tonne)'] }
    ]
  },
  {
    make: 'Isuzu',
    country: 'Japan',
    models: [
      { name: 'N-Series', variants: ['NPR', 'NQR', 'NPS', 'NLR', 'NMR'], types: ['3-Tonne Truck', '5-Tonne Truck'] },
      { name: 'F-Series', variants: ['FRR', 'FSR', 'FTR', 'FVR', 'FVZ'], types: ['7-Tonne Truck', '10-Tonne Truck', '15-Tonne Truck', 'Flatbed Truck (10-Tonne)'] },
      { name: 'FX-Series', variants: ['FXR', 'FXZ', 'FXD', 'FXM'], types: ['Truck Tractor (Horse Only)', 'Interlink (34-Tonne)'] },
      { name: 'Giga', variants: ['CYZ', 'EXZ', 'C&E Series'], types: ['Truck Tractor (Horse Only)', 'Interlink (34-Tonne)', 'Tanker Truck'] },
      { name: 'D-Max', variants: ['Single Cab', 'Double Cab'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] }
    ]
  },
  {
    make: 'Toyota',
    country: 'Japan',
    models: [
      { name: 'Dyna', variants: ['Dyna 150', 'Dyna 200', 'Dyna 300'], types: ['3-Tonne Truck', '5-Tonne Truck'] },
      { name: 'Vitz', variants: ['1.0', '1.3', 'Hybrid'], types: ['Compact Hatchback'] },
      { name: 'Yaris', variants: ['Hatch', 'Sedan', 'Cross'], types: ['Compact Hatchback', 'Sedan', 'Compact SUV / Crossover'] },
      { name: 'Aqua', variants: ['Hybrid', 'X', 'G'], types: ['Compact Hatchback'] },
      { name: 'Corolla', variants: ['Quest', 'Sedan', 'Hybrid'], types: ['Sedan'] },
      { name: 'Corolla Cross', variants: ['XS', 'XR', 'Hybrid'], types: ['Compact SUV / Crossover'] },
      { name: 'RAV4', variants: ['GX', 'VX', 'Hybrid'], types: ['Compact SUV / Crossover'] },
      { name: 'Fortuner', variants: ['2.4 GD-6', '2.8 GD-6', '4x4'], types: ['Compact SUV / Crossover'] },
      { name: 'Hilux', variants: ['Single Cab', 'Xtra Cab', 'Double Cab', '48V Double Cab'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] },
      { name: 'Land Cruiser 70', variants: ['79 Single Cab', '79 Double Cab', 'Troop Carrier'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] },
      { name: 'HiAce', variants: ['Panel Van', 'Sesfikile', 'Crew Van'], types: ['Panel Van', 'Delivery Van'] },
      { name: 'Quantum', variants: ['Panel Van', 'Crew Cab', 'Bus'], types: ['Panel Van', 'Delivery Van'] },
      { name: 'Proace', variants: ['City', 'Medium Van', 'Long Van'], types: ['Panel Van', 'Delivery Van'] }
    ]
  },
  {
    make: 'Ford',
    country: 'United States',
    isPopular: true,
    models: [
      { name: 'Ranger', variants: ['Single Cab', 'Super Cab', 'Double Cab', 'Raptor'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] },
      { name: 'EcoSport', variants: ['Ambiente', 'Trend', 'Titanium'], types: ['Compact SUV / Crossover'] },
      { name: 'Territory', variants: ['Ambiente', 'Trend', 'Titanium'], types: ['Compact SUV / Crossover'] },
      { name: 'Transit', variants: ['Panel Van', 'Single Chassis Cab', 'Double Chassis Cab'], types: ['Panel Van', 'Delivery Van', '3-Tonne Truck'] },
      { name: 'Transit Custom', variants: ['Panel Van', 'Sport', 'Trend'], types: ['Panel Van', 'Delivery Van'] },
      { name: 'Tourneo Custom', variants: ['People Mover', 'Crew Van'], types: ['Delivery Van', 'Panel Van'] }
    ]
  },
  {
    make: 'GWM',
    country: 'China',
    isPopular: true,
    models: [
      { name: 'P-Series', variants: ['Commercial Single Cab', 'Commercial Double Cab', 'LT Double Cab', 'LS Double Cab'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] },
      { name: 'Haval Jolion', variants: ['City', 'Premium', 'Lux', 'Super Luxury'], types: ['Compact SUV / Crossover'] },
      { name: 'Haval H6', variants: ['Premium', 'Luxury', 'Super Luxury', 'GT'], types: ['Compact SUV / Crossover'] },
      { name: 'P300', variants: ['SX', 'LT', 'LTD', 'Commercial Double Cab'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] },
      { name: 'P500', variants: ['2.4T Double Cab', 'HEV Double Cab', 'Luxury', 'Ultra Luxury'], types: ['Double Cab Bakkie'] },
      { name: 'Steed', variants: ['Steed 5 Single Cab', 'Steed 5 Double Cab', 'Steed 6 Double Cab'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] },
      { name: 'Wingle', variants: ['Single Cab', 'Double Cab'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] }
    ]
  },
  {
    make: 'Volkswagen',
    country: 'Germany',
    isPopular: true,
    models: [
      { name: 'Amarok', variants: ['Single Cab', 'Double Cab', 'PanAmericana', 'Aventura'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] },
      { name: 'Polo', variants: ['Vivo', 'TSI', 'Life', 'R-Line'], types: ['Compact Hatchback'] },
      { name: 'T-Cross', variants: ['Comfortline', 'Highline', 'R-Line'], types: ['Compact SUV / Crossover'] },
      { name: 'Caddy Cargo', variants: ['Cargo', 'Maxi Cargo'], types: ['Panel Van', 'Delivery Van'] },
      { name: 'Transporter', variants: ['Panel Van', 'Kombi', 'Crew Bus'], types: ['Panel Van', 'Delivery Van'] },
      { name: 'Crafter', variants: ['Panel Van', 'Long Wheelbase', 'Extra Long Wheelbase', 'Chassis Cab'], types: ['Panel Van', 'Delivery Van', '3-Tonne Truck'] }
    ]
  },
  {
    make: 'Mahindra',
    country: 'India',
    models: [
      { name: 'Pik Up', variants: ['Single Cab', 'Double Cab', 'Karoo', 'S11'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] },
      { name: 'Bolero', variants: ['Single Cab', 'Maxi Truck', 'Dropside'], types: ['Single Cab Bakkie', '3-Tonne Truck'] },
      { name: 'Scorpio Pik Up', variants: ['Single Cab', 'Double Cab'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] }
    ]
  },
  {
    make: 'JAC',
    country: 'China',
    models: [
      { name: 'T6', variants: ['Single Cab', 'Double Cab'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] },
      { name: 'T8', variants: ['Double Cab', '4x2', '4x4'], types: ['Double Cab Bakkie'] },
      { name: 'T9', variants: ['Double Cab', 'Hunter', '4x4'], types: ['Double Cab Bakkie'] },
      { name: 'X200', variants: ['Single Cab', 'Double Cab', 'Dropside'], types: ['Single Cab Bakkie', '3-Tonne Truck'] }
    ]
  },
  {
    make: 'Peugeot',
    country: 'France',
    models: [
      { name: 'Partner', variants: ['Panel Van', 'Long Panel Van'], types: ['Panel Van', 'Delivery Van'] },
      { name: 'Expert', variants: ['Panel Van', 'Crew Van'], types: ['Panel Van', 'Delivery Van'] },
      { name: 'Boxer', variants: ['Panel Van', 'Chassis Cab'], types: ['Panel Van', 'Delivery Van', '3-Tonne Truck'] }
    ]
  },
  {
    make: 'Renault',
    country: 'France',
    models: [
      { name: 'Kangoo', variants: ['Panel Van', 'Express', 'Maxi'], types: ['Panel Van', 'Delivery Van'] },
      { name: 'Trafic', variants: ['Panel Van', 'Crew Van', 'Long Wheelbase'], types: ['Panel Van', 'Delivery Van'] },
      { name: 'Master', variants: ['Panel Van', 'Chassis Cab'], types: ['Panel Van', 'Delivery Van', '3-Tonne Truck'] }
    ]
  },
  {
    make: 'Opel',
    country: 'Germany',
    models: [
      { name: 'Combo Cargo', variants: ['Panel Van', 'Long Wheelbase'], types: ['Panel Van', 'Delivery Van'] },
      { name: 'Vivaro Cargo', variants: ['Panel Van', 'Long Wheelbase'], types: ['Panel Van', 'Delivery Van'] },
      { name: 'Movano', variants: ['Panel Van', 'Chassis Cab'], types: ['Panel Van', 'Delivery Van', '3-Tonne Truck'] }
    ]
  },
  {
    make: 'Fiat Professional',
    country: 'Italy',
    models: [
      { name: 'Fiorino', variants: ['Panel Van'], types: ['Panel Van', 'Delivery Van'] },
      { name: 'Doblo Cargo', variants: ['Cargo', 'Maxi Cargo'], types: ['Panel Van', 'Delivery Van'] },
      { name: 'Ducato', variants: ['Panel Van', 'Chassis Cab'], types: ['Panel Van', 'Delivery Van', '3-Tonne Truck'] },
      { name: 'Scudo', variants: ['Panel Van', 'Crew Van'], types: ['Panel Van', 'Delivery Van'] }
    ]
  },
  {
    make: 'Hyundai',
    country: 'South Korea',
    models: [
      { name: 'H100', variants: ['Bakkie', 'Dropside', 'Tipper'], types: ['Single Cab Bakkie', '3-Tonne Truck'] },
      { name: 'i20', variants: ['Motion', 'Fluid', 'N-Line'], types: ['Compact Hatchback'] },
      { name: 'Grand i10', variants: ['Motion', 'Fluid'], types: ['Compact Hatchback'] },
      { name: 'Accent', variants: ['Sedan', 'Fluid'], types: ['Sedan'] },
      { name: 'Creta', variants: ['Premium', 'Executive', 'Elite'], types: ['Compact SUV / Crossover'] },
      { name: 'Tucson', variants: ['Premium', 'Executive', 'Elite'], types: ['Compact SUV / Crossover'] },
      { name: 'Porter', variants: ['Single Cab', 'Dropside'], types: ['Single Cab Bakkie', '3-Tonne Truck'] },
      { name: 'Staria', variants: ['Panel Van', 'Multicab'], types: ['Panel Van', 'Delivery Van'] }
    ]
  },
  {
    make: 'Kia',
    country: 'South Korea',
    models: [
      { name: 'K2700', variants: ['Workhorse', 'Dropside'], types: ['Single Cab Bakkie', '3-Tonne Truck'] },
      { name: 'K2500', variants: ['Dropside', 'Chassis Cab'], types: ['Single Cab Bakkie', '3-Tonne Truck'] },
      { name: 'Picanto', variants: ['Start', 'Street', 'Style'], types: ['Compact Hatchback'] },
      { name: 'Rio', variants: ['Hatch', 'Sedan'], types: ['Compact Hatchback', 'Sedan'] },
      { name: 'Seltos', variants: ['EX', 'GT-Line'], types: ['Compact SUV / Crossover'] },
      { name: 'Sportage', variants: ['LX', 'EX', 'GT-Line'], types: ['Compact SUV / Crossover'] }
    ]
  },
  {
    make: 'Mazda',
    country: 'Japan',
    models: [
      { name: 'Demio', variants: ['13C', '13S', 'Skyactiv'], types: ['Compact Hatchback'] },
      { name: 'Axela', variants: ['Sport', 'Sedan', 'Hybrid'], types: ['Compact Hatchback', 'Sedan'] },
      { name: 'CX-3', variants: ['Active', 'Dynamic', 'Individual'], types: ['Compact SUV / Crossover'] },
      { name: 'CX-5', variants: ['Active', 'Dynamic', 'Akera'], types: ['Compact SUV / Crossover'] },
      { name: 'BT-50', variants: ['Single Cab', 'Freestyle Cab', 'Double Cab'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] },
      { name: 'B-Series', variants: ['Single Cab', 'Double Cab'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] }
    ]
  },
  {
    make: 'Foton',
    country: 'China',
    models: [
      { name: 'Tunland', variants: ['Single Cab', 'Double Cab', 'G7', 'V7', 'V9'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] },
      { name: 'View', variants: ['Panel Van', 'Crew Van'], types: ['Panel Van', 'Delivery Van'] },
      { name: 'Miler', variants: ['Dropside', 'Chassis Cab'], types: ['Single Cab Bakkie', '3-Tonne Truck'] }
    ]
  },
  {
    make: 'Suzuki',
    country: 'Japan',
    models: [
      { name: 'Super Carry', variants: ['Dropside', 'Panel Van Conversion'], types: ['Single Cab Bakkie', 'Delivery Van'] },
      { name: 'Carry', variants: ['Dropside', 'Van'], types: ['Single Cab Bakkie', 'Delivery Van'] },
      { name: 'Swift', variants: ['GL', 'GLX', 'Sport'], types: ['Compact Hatchback'] },
      { name: 'Baleno', variants: ['GL', 'GLX'], types: ['Compact Hatchback'] },
      { name: 'Dzire', variants: ['GA', 'GL'], types: ['Sedan'] },
      { name: 'Vitara Brezza', variants: ['GL', 'GLX'], types: ['Compact SUV / Crossover'] },
      { name: 'Ertiga', variants: ['GA', 'GL', 'GLX'], types: ['MPV / People Carrier'] }
    ]
  },
  {
    make: 'Mitsubishi',
    country: 'Japan',
    models: [
      { name: 'Triton', variants: ['Single Cab', 'Club Cab', 'Double Cab'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] },
      { name: 'L200', variants: ['Single Cab', 'Club Cab', 'Double Cab'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] },
      { name: 'ASX', variants: ['GL', 'GLX', 'Aspire'], types: ['Compact SUV / Crossover'] },
      { name: 'Outlander', variants: ['GLX', 'Exceed', 'PHEV'], types: ['Compact SUV / Crossover'] },
      { name: 'Delica', variants: ['Panel Van', 'Crew Van'], types: ['Panel Van', 'Delivery Van', 'MPV / People Carrier'] }
    ]
  },
  {
    make: 'Citroen',
    country: 'France',
    models: [
      { name: 'Berlingo Van', variants: ['Panel Van', 'Long Panel Van'], types: ['Panel Van', 'Delivery Van'] },
      { name: 'Dispatch', variants: ['Panel Van', 'Crew Van'], types: ['Panel Van', 'Delivery Van'] },
      { name: 'Relay', variants: ['Panel Van', 'Chassis Cab'], types: ['Panel Van', 'Delivery Van', '3-Tonne Truck'] }
    ]
  },
  {
    make: 'Nissan',
    country: 'Japan',
    models: [
      { name: 'NP300 / Hardbody', variants: ['Single Cab', 'Double Cab'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] },
      { name: 'Navara', variants: ['Single Cab', 'Double Cab'], types: ['Single Cab Bakkie', 'Double Cab Bakkie'] },
      { name: 'Micra', variants: ['Visia', 'Acenta', 'Tekna'], types: ['Compact Hatchback'] },
      { name: 'Almera', variants: ['Acenta', 'Tekna'], types: ['Sedan'] },
      { name: 'Qashqai', variants: ['Visia', 'Acenta', 'Tekna'], types: ['Compact SUV / Crossover'] },
      { name: 'X-Trail', variants: ['Visia', 'Acenta', 'Tekna'], types: ['Compact SUV / Crossover'] },
      { name: 'Cabstar', variants: ['NT400', 'Atlas'], types: ['3-Tonne Truck', '5-Tonne Truck'] },
      { name: 'NV350', variants: ['Panel Van', 'Crew Van'], types: ['Panel Van', 'Delivery Van'] },
      { name: 'Interstar', variants: ['Panel Van', 'Chassis Cab'], types: ['Panel Van', 'Delivery Van', '3-Tonne Truck'] },
      { name: 'Civilian', variants: ['Bus Chassis'], types: ['Delivery Van'] }
    ]
  },
  {
    make: 'Mitsubishi Fuso',
    country: 'Japan',
    models: [
      { name: 'Canter', variants: ['FE', 'FG', 'TF'], types: ['3-Tonne Truck', '5-Tonne Truck'] },
      { name: 'Fighter', variants: ['FK', 'FM', 'FN'], types: ['7-Tonne Truck', '10-Tonne Truck', '15-Tonne Truck'] },
      { name: 'Super Great', variants: ['FP', 'FV', 'FS'], types: ['Truck Tractor (Horse Only)', 'Interlink (34-Tonne)', 'Tanker Truck'] },
      { name: 'Rosa', variants: ['BE', 'Bus Chassis'], types: ['Delivery Van'] }
    ]
  },
  {
    make: 'Mercedes-Benz',
    country: 'Germany',
    models: [
      { name: 'Sprinter', variants: ['Panel Van', 'Chassis Cab'], types: ['Panel Van', 'Delivery Van'] },
      { name: 'Atego', variants: ['815', '1018', '1324', '1524'], types: ['5-Tonne Truck', '7-Tonne Truck', '10-Tonne Truck'] },
      { name: 'Axor', variants: ['1823', '2628', '3340'], types: ['10-Tonne Truck', '15-Tonne Truck', 'Truck Tractor (Horse Only)'] },
      { name: 'Actros', variants: ['1845', '2645', '3345', '4145'], types: ['Truck Tractor (Horse Only)', 'Interlink (34-Tonne)'] },
      { name: 'Arocs', variants: ['2640', '3345', '4145'], types: ['Tipper Truck (10-Tonne)', 'Flatbed Truck (10-Tonne)', 'Timber / Wood Carrier Truck'] },
      { name: 'Econic', variants: ['Refuse', 'Municipal'], types: ['10-Tonne Truck', '15-Tonne Truck'] }
    ]
  },
  {
    make: 'MAN',
    country: 'Germany',
    models: [
      { name: 'TGL', variants: ['8.180', '10.220', '12.250'], types: ['5-Tonne Truck', '7-Tonne Truck'] },
      { name: 'TGM', variants: ['15.250', '18.290', '26.320'], types: ['10-Tonne Truck', '15-Tonne Truck', 'Flatbed Truck (10-Tonne)'] },
      { name: 'TGS', variants: ['26.440', '33.480', '41.480'], types: ['Truck Tractor (Horse Only)', 'Tipper Truck (10-Tonne)', 'Timber / Wood Carrier Truck'] },
      { name: 'TGX', variants: ['18.440', '26.480', '33.540'], types: ['Truck Tractor (Horse Only)', 'Interlink (34-Tonne)'] },
      { name: 'CLA', variants: ['15.220', '26.280'], types: ['10-Tonne Truck', '15-Tonne Truck'] }
    ]
  },
  {
    make: 'Scania',
    country: 'Sweden',
    models: [
      { name: 'L-Series', variants: ['L280', 'L320'], types: ['5-Tonne Truck', '7-Tonne Truck'] },
      { name: 'P-Series', variants: ['P280', 'P320', 'P410'], types: ['7-Tonne Truck', '10-Tonne Truck', 'Tipper Truck (10-Tonne)'] },
      { name: 'G-Series', variants: ['G410', 'G450', 'G500'], types: ['Truck Tractor (Horse Only)', 'Flatbed Truck (10-Tonne)', 'Timber / Wood Carrier Truck'] },
      { name: 'R-Series', variants: ['R450', 'R500', 'R580'], types: ['Truck Tractor (Horse Only)', 'Interlink (34-Tonne)', 'Timber / Wood Carrier Truck'] },
      { name: 'S-Series', variants: ['S500', 'S580', 'S730'], types: ['Truck Tractor (Horse Only)', 'Interlink (34-Tonne)'] },
      { name: 'XT Range', variants: ['P XT', 'G XT', 'R XT'], types: ['Tipper Truck (10-Tonne)', 'Timber / Wood Carrier Truck'] }
    ]
  },
  {
    make: 'Volvo',
    country: 'Sweden',
    models: [
      { name: 'FL', variants: ['FL 4x2', 'FL Electric'], types: ['3-Tonne Truck', '5-Tonne Truck', 'Delivery Van'] },
      { name: 'FE', variants: ['FE 4x2', 'FE 6x2'], types: ['7-Tonne Truck', '10-Tonne Truck'] },
      { name: 'FM', variants: ['FM 380', 'FM 420', 'FM 500'], types: ['Truck Tractor (Horse Only)', 'Flatbed Truck (10-Tonne)', 'Tanker Truck'] },
      { name: 'FMX', variants: ['FMX 6x4', 'FMX 8x4'], types: ['Tipper Truck (10-Tonne)', 'Timber / Wood Carrier Truck'] },
      { name: 'FH', variants: ['FH 420', 'FH 460', 'FH 500'], types: ['Truck Tractor (Horse Only)', 'Interlink (34-Tonne)'] },
      { name: 'FH16', variants: ['FH16 550', 'FH16 650', 'FH16 750'], types: ['Truck Tractor (Horse Only)', 'Interlink (34-Tonne)', 'Timber / Wood Carrier Truck'] }
    ]
  },
  {
    make: 'UD Trucks',
    country: 'Japan',
    models: [
      { name: 'Kuzer', variants: ['RKE', 'RKE 150'], types: ['3-Tonne Truck', '5-Tonne Truck'] },
      { name: 'Croner', variants: ['LKE', 'MKE', 'PKE'], types: ['5-Tonne Truck', '7-Tonne Truck', '10-Tonne Truck'] },
      { name: 'Quester', variants: ['CDE', 'GKE', 'GWE', 'GWE Tractor'], types: ['15-Tonne Truck', 'Truck Tractor (Horse Only)', 'Interlink (34-Tonne)', 'Tipper Truck (10-Tonne)'] },
      { name: 'Quon', variants: ['CG', 'CW', 'GK'], types: ['Truck Tractor (Horse Only)', 'Interlink (34-Tonne)'] }
    ]
  },
  {
    make: 'Iveco',
    country: 'Italy',
    models: [
      { name: 'Daily', variants: ['Van', 'Chassis Cab'], types: ['Panel Van', 'Delivery Van', '3-Tonne Truck'] },
      { name: 'Eurocargo', variants: ['ML75', 'ML120', 'ML150'], types: ['5-Tonne Truck', '7-Tonne Truck', '10-Tonne Truck'] },
      { name: 'S-Way', variants: ['AS440', 'AT440'], types: ['Truck Tractor (Horse Only)', 'Interlink (34-Tonne)'] },
      { name: 'X-Way', variants: ['AD', 'AT'], types: ['Flatbed Truck (10-Tonne)', 'Truck Tractor (Horse Only)'] },
      { name: 'T-Way', variants: ['AD410', 'AT720'], types: ['Tipper Truck (10-Tonne)', 'Timber / Wood Carrier Truck'] }
    ]
  },
  {
    make: 'FAW',
    country: 'China',
    models: [
      { name: '8.140FL', variants: ['4x2 Freight Carrier'], types: ['5-Tonne Truck', '7-Tonne Truck'] },
      { name: '15.180FL', variants: ['Freight Carrier'], types: ['10-Tonne Truck', '15-Tonne Truck'] },
      { name: '15.180FT', variants: ['4x2 Truck Tractor'], types: ['Truck Tractor (Horse Only)'] },
      { name: '16.240FT', variants: ['4x2 Truck Tractor'], types: ['Truck Tractor (Horse Only)'] },
      { name: '28.380FT', variants: ['6x4 Truck Tractor'], types: ['Truck Tractor (Horse Only)', 'Interlink (34-Tonne)'] },
      { name: 'JH6', variants: ['Truck Tractor', 'Tipper'], types: ['Truck Tractor (Horse Only)', 'Tipper Truck (10-Tonne)'] }
    ]
  },
  {
    make: 'CNHTC (Howo)',
    country: 'China',
    models: [
      { name: 'HOWO A7', variants: ['6x4 Tractor', '8x4 Tipper'], types: ['Truck Tractor (Horse Only)', 'Tipper Truck (10-Tonne)'] },
      { name: 'HOWO T7H', variants: ['6x4 Tractor', 'Mixer', 'Tipper'], types: ['Truck Tractor (Horse Only)', 'Tipper Truck (10-Tonne)', 'Interlink (34-Tonne)'] },
      { name: 'Sitrak C7H', variants: ['Truck Tractor', 'Tipper'], types: ['Truck Tractor (Horse Only)', 'Tipper Truck (10-Tonne)'] }
    ]
  },
  {
    make: 'DAF',
    country: 'Netherlands',
    models: [
      { name: 'LF', variants: ['LF 180', 'LF 230'], types: ['5-Tonne Truck', '7-Tonne Truck'] },
      { name: 'CF', variants: ['CF 340', 'CF 410', 'CF 450'], types: ['10-Tonne Truck', 'Truck Tractor (Horse Only)', 'Flatbed Truck (10-Tonne)'] },
      { name: 'XF', variants: ['XF 480', 'XF 530'], types: ['Truck Tractor (Horse Only)', 'Interlink (34-Tonne)'] },
      { name: 'XD', variants: ['XD 300', 'XD 450'], types: ['7-Tonne Truck', '10-Tonne Truck'] },
      { name: 'XG', variants: ['XG 480', 'XG+ 530'], types: ['Truck Tractor (Horse Only)', 'Interlink (34-Tonne)'] }
    ]
  },
  {
    make: 'Renault Trucks',
    country: 'France',
    models: [
      { name: 'D', variants: ['D Wide', 'D Cab'], types: ['5-Tonne Truck', '7-Tonne Truck', '10-Tonne Truck'] },
      { name: 'C', variants: ['C 380', 'C 440'], types: ['Flatbed Truck (10-Tonne)', 'Truck Tractor (Horse Only)'] },
      { name: 'K', variants: ['K 440', 'K 520'], types: ['Tipper Truck (10-Tonne)', 'Timber / Wood Carrier Truck'] },
      { name: 'T', variants: ['T 440', 'T 480', 'T High'], types: ['Truck Tractor (Horse Only)', 'Interlink (34-Tonne)'] }
    ]
  },
  {
    make: 'Afrit',
    country: 'South Africa',
    models: [
      { name: 'Flatdeck Semi-Trailer', variants: ['Tri-Axle Flatdeck'], types: ['Truck Tractor (Horse Only)'] },
      { name: 'Tautliner Semi-Trailer', variants: ['Curtain Side'], types: ['Truck Tractor (Horse Only)'] },
      { name: 'Side Tipper', variants: ['Interlink Side Tipper'], types: ['Truck Tractor (Horse Only)'] },
      { name: 'Timber Trailer', variants: ['Stanchion Timber Trailer'], types: ['Truck Tractor (Horse Only)', 'Timber / Wood Carrier Truck'] }
    ]
  },
  {
    make: 'Henred Fruehauf',
    country: 'South Africa',
    models: [
      { name: 'Flatdeck', variants: ['Tri-Axle Flatdeck'], types: ['Truck Tractor (Horse Only)'] },
      { name: 'Tautliner', variants: ['Curtain Side'], types: ['Truck Tractor (Horse Only)'] },
      { name: 'Skeletal Trailer', variants: ['Container Skeletal'], types: ['Truck Tractor (Horse Only)'] },
      { name: 'Timber Carrier', variants: ['Log Carrier', 'Pole Carrier'], types: ['Timber / Wood Carrier Truck', 'Truck Tractor (Horse Only)'] }
    ]
  },
  {
    make: 'SA Truck Bodies',
    country: 'South Africa',
    models: [
      { name: 'Tautliner', variants: ['Curtain Side'], types: ['Truck Tractor (Horse Only)'] },
      { name: 'Flatdeck', variants: ['Tri-Axle'], types: ['Truck Tractor (Horse Only)'] },
      { name: 'Refrigerated Trailer', variants: ['Reefer'], types: ['Truck Tractor (Horse Only)'] },
      { name: 'Timber Body', variants: ['Rigid Timber Body', 'Semi-Trailer Timber Body'], types: ['Timber / Wood Carrier Truck'] }
    ]
  },
  {
    make: 'GRW',
    country: 'South Africa',
    models: [
      { name: 'Fuel Tanker', variants: ['Aluminium Tanker', 'Steel Tanker'], types: ['Tanker Truck', 'Truck Tractor (Horse Only)'] },
      { name: 'Food Grade Tanker', variants: ['Milk Tanker', 'Water Tanker'], types: ['Tanker Truck', 'Truck Tractor (Horse Only)'] },
      { name: 'Side Tipper', variants: ['Interlink Side Tipper'], types: ['Truck Tractor (Horse Only)'] }
    ]
  },
  {
    make: 'Dennison Trailers',
    country: 'United Kingdom',
    models: [
      { name: 'Timber Skeletal Trailer', variants: ['Timber bolsters', 'Crane-ready'], types: ['Timber / Wood Carrier Truck', 'Truck Tractor (Horse Only)'] },
      { name: 'Skeletal Trailer', variants: ['Container skeletal'], types: ['Truck Tractor (Horse Only)'] },
      { name: 'Platform Trailer', variants: ['Flatbed platform'], types: ['Truck Tractor (Horse Only)'] }
    ]
  },
  {
    make: 'Faymonville',
    country: 'Belgium',
    models: [
      { name: 'TimberMAX', variants: ['2 Axle', '3 Axle'], types: ['Timber / Wood Carrier Truck', 'Truck Tractor (Horse Only)'] },
      { name: 'TeleMAX', variants: ['Extendable flatbed'], types: ['Truck Tractor (Horse Only)'] },
      { name: 'MultiMAX', variants: ['Low loader'], types: ['Truck Tractor (Horse Only)'] }
    ]
  },
  {
    make: 'Schmitz Cargobull',
    country: 'Germany',
    models: [
      { name: 'S.CS Curtainsider', variants: ['Mega', 'Universal'], types: ['Truck Tractor (Horse Only)'] },
      { name: 'S.KO Cool', variants: ['Reefer'], types: ['Truck Tractor (Horse Only)'] },
      { name: 'S.CF Container Chassis', variants: ['20ft', '40ft'], types: ['Truck Tractor (Horse Only)'] }
    ]
  },
  {
    make: 'Krone',
    country: 'Germany',
    models: [
      { name: 'Profi Liner', variants: ['Curtain side'], types: ['Truck Tractor (Horse Only)'] },
      { name: 'Cool Liner', variants: ['Reefer'], types: ['Truck Tractor (Horse Only)'] },
      { name: 'Box Liner', variants: ['Container chassis'], types: ['Truck Tractor (Horse Only)'] }
    ]
  },
  {
    make: 'Kerr Trailers',
    country: 'Canada',
    models: [
      { name: 'Log Trailer', variants: ['Forestry log trailer'], types: ['Timber / Wood Carrier Truck', 'Truck Tractor (Horse Only)'] },
      { name: 'B-Train Log Trailer', variants: ['Forestry B-train'], types: ['Timber / Wood Carrier Truck', 'Truck Tractor (Horse Only)'] }
    ]
  },
  {
    make: 'STEPA',
    country: 'Austria',
    models: [
      { name: 'Forestry Trailer', variants: ['Articulated drawbar', 'Crane-ready'], types: ['Timber / Wood Carrier Truck'] },
      { name: 'Timber Trailer', variants: ['Stanchion trailer'], types: ['Timber / Wood Carrier Truck'] }
    ]
  }
];

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/palmtrent');
};

const getVehicleTypeIds = async (typeNames = []) => {
  const types = await VehicleType.find({ name: { $in: typeNames } }).select('_id name');
  return types.map(type => type._id);
};

const seedVehicleModels = async ({ connect = true, exit = false } = {}) => {
  try {
    if (connect) await connectDB();
    let makeCount = 0;
    let modelCount = 0;

    for (const makeRecord of vehicleModelSeedData) {
      const make = await VehicleMake.findOneAndUpdate(
        { name: new RegExp(`^${makeRecord.make.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        {
          $setOnInsert: {
            name: makeRecord.make,
            country: makeRecord.country || '',
            isPopular: Boolean(makeRecord.isPopular)
          }
        },
        { upsert: true, new: true }
      );
      makeCount += 1;

      for (const modelRecord of makeRecord.models) {
        const compatibleVehicleTypes = await getVehicleTypeIds(modelRecord.types || []);
        await VehicleModel.findOneAndUpdate(
          { make: make._id, name: modelRecord.name },
          {
            make: make._id,
            name: modelRecord.name,
            variants: modelRecord.variants || [],
            yearRange: modelRecord.yearRange || { start: 2000 },
            specifications: {
              fuelType: modelRecord.fuelType || 'diesel',
              transmission: modelRecord.transmission || 'manual'
            },
            compatibleVehicleTypes
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        modelCount += 1;
      }
    }

    const summary = { makesProcessed: makeCount, modelsSeeded: modelCount };
    if (exit) process.exit(0);
    return summary;
  } catch (error) {
    if (exit) {
      console.error(error);
      process.exit(1);
    }
    throw error;
  }
};

if (require.main === module) {
  seedVehicleModels({ connect: true, exit: true });
}

module.exports = { seedVehicleModels, vehicleModelSeedData };
