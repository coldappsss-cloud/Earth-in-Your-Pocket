export interface Currency {
  name: string;
  code: string;
  symbol: string;
}

export interface Country {
  name: string;
  code: string; // ISO 3166-1 alpha-2 lowercase — used for flags
  capital: string;
  population: number;
  area: number; // km²
  currency: Currency;
  language: string;
  continent: string;
  lat: number;
  lon: number;
  region?: string;
}

export const COUNTRIES: Country[] = [
  // Africa
  { name: 'Algeria', code: 'dz', capital: 'Algiers', population: 44700000, area: 2381741, currency: { name: 'Algerian Dinar', code: 'DZD', symbol: 'دج' }, language: 'Arabic', continent: 'Africa', lat: 28.0339, lon: 1.6596 },
  { name: 'Angola', code: 'ao', capital: 'Luanda', population: 34504000, area: 1246700, currency: { name: 'Kwanza', code: 'AOA', symbol: 'Kz' }, language: 'Portuguese', continent: 'Africa', lat: -11.2027, lon: 17.8739 },
  { name: 'Botswana', code: 'bw', capital: 'Gaborone', population: 2630000, area: 581730, currency: { name: 'Pula', code: 'BWP', symbol: 'P' }, language: 'English', continent: 'Africa', lat: -22.3285, lon: 24.6849 },
  { name: 'Cameroon', code: 'cm', capital: 'Yaoundé', population: 27200000, area: 475442, currency: { name: 'Central African CFA franc', code: 'XAF', symbol: 'Fr' }, language: 'French', continent: 'Africa', lat: 3.8480, lon: 11.5021 },
  { name: 'DR Congo', code: 'cd', capital: 'Kinshasa', population: 99010000, area: 2344858, currency: { name: 'Congolese Franc', code: 'CDF', symbol: 'FC' }, language: 'French', continent: 'Africa', lat: -4.0383, lon: 21.7587 },
  { name: 'Egypt', code: 'eg', capital: 'Cairo', population: 105000000, area: 1002450, currency: { name: 'Egyptian Pound', code: 'EGP', symbol: '£' }, language: 'Arabic', continent: 'Africa', lat: 26.8206, lon: 30.8025 },
  { name: 'Ethiopia', code: 'et', capital: 'Addis Ababa', population: 117900000, area: 1104300, currency: { name: 'Ethiopian Birr', code: 'ETB', symbol: 'Br' }, language: 'Amharic', continent: 'Africa', lat: 9.1450, lon: 40.4897 },
  { name: 'Ghana', code: 'gh', capital: 'Accra', population: 32400000, area: 238533, currency: { name: 'Ghanaian Cedi', code: 'GHS', symbol: '₵' }, language: 'English', continent: 'Africa', lat: 7.9465, lon: -1.0232 },
  { name: 'Ivory Coast', code: 'ci', capital: 'Yamoussoukro', population: 27500000, area: 322463, currency: { name: 'West African CFA franc', code: 'XOF', symbol: 'Fr' }, language: 'French', continent: 'Africa', lat: 7.5400, lon: -5.5471 },
  { name: 'Kenya', code: 'ke', capital: 'Nairobi', population: 54000000, area: 580367, currency: { name: 'Kenyan Shilling', code: 'KES', symbol: 'KSh' }, language: 'Swahili', continent: 'Africa', lat: -0.0236, lon: 37.9062 },
  { name: 'Libya', code: 'ly', capital: 'Tripoli', population: 6960000, area: 1759540, currency: { name: 'Libyan Dinar', code: 'LYD', symbol: 'ل.د' }, language: 'Arabic', continent: 'Africa', lat: 26.3351, lon: 17.2283 },
  { name: 'Madagascar', code: 'mg', capital: 'Antananarivo', population: 27692000, area: 587041, currency: { name: 'Malagasy Ariary', code: 'MGA', symbol: 'Ar' }, language: 'Malagasy', continent: 'Africa', lat: -18.7669, lon: 46.8691 },
  { name: 'Mali', code: 'ml', capital: 'Bamako', population: 22400000, area: 1240192, currency: { name: 'West African CFA franc', code: 'XOF', symbol: 'Fr' }, language: 'French', continent: 'Africa', lat: 17.5707, lon: -3.9962 },
  { name: 'Morocco', code: 'ma', capital: 'Rabat', population: 37457000, area: 710850, currency: { name: 'Moroccan Dirham', code: 'MAD', symbol: 'دره' }, language: 'Arabic', continent: 'Africa', lat: 31.7917, lon: -7.0926 },
  { name: 'Mozambique', code: 'mz', capital: 'Maputo', population: 32800000, area: 801590, currency: { name: 'Mozambican Metical', code: 'MZN', symbol: 'MT' }, language: 'Portuguese', continent: 'Africa', lat: -18.6657, lon: 35.5296 },
  { name: 'Namibia', code: 'na', capital: 'Windhoek', population: 2587000, area: 825615, currency: { name: 'Namibian Dollar', code: 'NAD', symbol: 'N$' }, language: 'English', continent: 'Africa', lat: -22.9576, lon: 18.4904 },
  { name: 'Nigeria', code: 'ng', capital: 'Abuja', population: 213400000, area: 923768, currency: { name: 'Nigerian Naira', code: 'NGN', symbol: '₦' }, language: 'English', continent: 'Africa', lat: 9.0820, lon: 8.6753 },
  { name: 'Rwanda', code: 'rw', capital: 'Kigali', population: 13463000, area: 26338, currency: { name: 'Rwandan Franc', code: 'RWF', symbol: 'Fr' }, language: 'Kinyarwanda', continent: 'Africa', lat: -1.9403, lon: 29.8739 },
  { name: 'Senegal', code: 'sn', capital: 'Dakar', population: 17196000, area: 196722, currency: { name: 'West African CFA franc', code: 'XOF', symbol: 'Fr' }, language: 'French', continent: 'Africa', lat: 14.4974, lon: -14.4524 },
  { name: 'Somalia', code: 'so', capital: 'Mogadishu', population: 17065000, area: 637657, currency: { name: 'Somali Shilling', code: 'SOS', symbol: 'Sh' }, language: 'Somali', continent: 'Africa', lat: 5.1521, lon: 46.1996 },
  { name: 'South Africa', code: 'za', capital: 'Pretoria', population: 60000000, area: 1221037, currency: { name: 'South African Rand', code: 'ZAR', symbol: 'R' }, language: 'Zulu', continent: 'Africa', lat: -30.5595, lon: 22.9375 },
  { name: 'Sudan', code: 'sd', capital: 'Khartoum', population: 44910000, area: 1861484, currency: { name: 'Sudanese Pound', code: 'SDG', symbol: 'ج.س.' }, language: 'Arabic', continent: 'Africa', lat: 12.8628, lon: 30.2176 },
  { name: 'Tanzania', code: 'tz', capital: 'Dodoma', population: 63298000, area: 945087, currency: { name: 'Tanzanian Shilling', code: 'TZS', symbol: 'Sh' }, language: 'Swahili', continent: 'Africa', lat: -6.3690, lon: 34.8888 },
  { name: 'Tunisia', code: 'tn', capital: 'Tunis', population: 12000000, area: 163610, currency: { name: 'Tunisian Dinar', code: 'TND', symbol: 'دت' }, language: 'Arabic', continent: 'Africa', lat: 33.8869, lon: 9.5375 },
  { name: 'Uganda', code: 'ug', capital: 'Kampala', population: 47100000, area: 241550, currency: { name: 'Ugandan Shilling', code: 'UGX', symbol: 'Sh' }, language: 'English', continent: 'Africa', lat: 1.3733, lon: 32.2903 },
  { name: 'Zambia', code: 'zm', capital: 'Lusaka', population: 19473000, area: 752618, currency: { name: 'Zambian Kwacha', code: 'ZMW', symbol: 'ZK' }, language: 'English', continent: 'Africa', lat: -13.1339, lon: 27.8493 },
  { name: 'Zimbabwe', code: 'zw', capital: 'Harare', population: 15780000, area: 390757, currency: { name: 'Zimbabwean Dollar', code: 'ZWL', symbol: 'Z$' }, language: 'English', continent: 'Africa', lat: -19.0154, lon: 29.1549 },

  // Americas
  { name: 'Argentina', code: 'ar', capital: 'Buenos Aires', population: 45606000, area: 2780400, currency: { name: 'Argentine Peso', code: 'ARS', symbol: '$' }, language: 'Spanish', continent: 'South America', lat: -38.4161, lon: -63.6167 },
  { name: 'Bolivia', code: 'bo', capital: 'Sucre', population: 12080000, area: 1098581, currency: { name: 'Bolivian Boliviano', code: 'BOB', symbol: 'Bs.' }, language: 'Spanish', continent: 'South America', lat: -16.2902, lon: -63.5887 },
  { name: 'Brazil', code: 'br', capital: 'Brasília', population: 215300000, area: 8515767, currency: { name: 'Brazilian Real', code: 'BRL', symbol: 'R$' }, language: 'Portuguese', continent: 'South America', lat: -14.2350, lon: -51.9253 },
  { name: 'Canada', code: 'ca', capital: 'Ottawa', population: 38246000, area: 9984670, currency: { name: 'Canadian Dollar', code: 'CAD', symbol: '$' }, language: 'English', continent: 'North America', lat: 56.1304, lon: -106.3468 },
  { name: 'Chile', code: 'cl', capital: 'Santiago', population: 19678000, area: 756102, currency: { name: 'Chilean Peso', code: 'CLP', symbol: '$' }, language: 'Spanish', continent: 'South America', lat: -35.6751, lon: -71.5430 },
  { name: 'Colombia', code: 'co', capital: 'Bogotá', population: 51049000, area: 1141748, currency: { name: 'Colombian Peso', code: 'COP', symbol: '$' }, language: 'Spanish', continent: 'South America', lat: 4.5709, lon: -74.2973 },
  { name: 'Costa Rica', code: 'cr', capital: 'San José', population: 5212000, area: 51100, currency: { name: 'Costa Rican Colón', code: 'CRC', symbol: '₡' }, language: 'Spanish', continent: 'North America', lat: 9.7489, lon: -83.7534 },
  { name: 'Cuba', code: 'cu', capital: 'Havana', population: 11326000, area: 109884, currency: { name: 'Cuban Peso', code: 'CUP', symbol: '$' }, language: 'Spanish', continent: 'North America', lat: 21.5218, lon: -77.7812 },
  { name: 'Dominican Republic', code: 'do', capital: 'Santo Domingo', population: 10800000, area: 48671, currency: { name: 'Dominican Peso', code: 'DOP', symbol: '$' }, language: 'Spanish', continent: 'North America', lat: 18.7357, lon: -70.1627 },
  { name: 'Ecuador', code: 'ec', capital: 'Quito', population: 18001000, area: 283561, currency: { name: 'US Dollar', code: 'USD', symbol: '$' }, language: 'Spanish', continent: 'South America', lat: -1.8312, lon: -78.1834 },
  { name: 'El Salvador', code: 'sv', capital: 'San Salvador', population: 6486000, area: 21041, currency: { name: 'US Dollar', code: 'USD', symbol: '$' }, language: 'Spanish', continent: 'North America', lat: 13.7942, lon: -88.8965 },
  { name: 'Guatemala', code: 'gt', capital: 'Guatemala City', population: 17109000, area: 108889, currency: { name: 'Guatemalan Quetzal', code: 'GTQ', symbol: 'Q' }, language: 'Spanish', continent: 'North America', lat: 15.7835, lon: -90.2308 },
  { name: 'Honduras', code: 'hn', capital: 'Tegucigalpa', population: 10280000, area: 112492, currency: { name: 'Honduran Lempira', code: 'HNL', symbol: 'L' }, language: 'Spanish', continent: 'North America', lat: 15.2000, lon: -86.2419 },
  { name: 'Jamaica', code: 'jm', capital: 'Kingston', population: 2961000, area: 10990, currency: { name: 'Jamaican Dollar', code: 'JMD', symbol: '$' }, language: 'English', continent: 'North America', lat: 18.1096, lon: -77.2975 },
  { name: 'Mexico', code: 'mx', capital: 'Mexico City', population: 130263000, area: 1964375, currency: { name: 'Mexican Peso', code: 'MXN', symbol: '$' }, language: 'Spanish', continent: 'North America', lat: 23.6345, lon: -102.5528 },
  { name: 'Nicaragua', code: 'ni', capital: 'Managua', population: 6948000, area: 130373, currency: { name: 'Nicaraguan Córdoba', code: 'NIO', symbol: 'C$' }, language: 'Spanish', continent: 'North America', lat: 12.8654, lon: -85.2072 },
  { name: 'Panama', code: 'pa', capital: 'Panama City', population: 4352000, area: 75420, currency: { name: 'Panamanian Balboa', code: 'PAB', symbol: 'B/.' }, language: 'Spanish', continent: 'North America', lat: 8.5380, lon: -80.7821 },
  { name: 'Paraguay', code: 'py', capital: 'Asunción', population: 7353000, area: 406752, currency: { name: 'Paraguayan Guaraní', code: 'PYG', symbol: '₲' }, language: 'Spanish', continent: 'South America', lat: -23.4425, lon: -58.4438 },
  { name: 'Peru', code: 'pe', capital: 'Lima', population: 33360000, area: 1285216, currency: { name: 'Peruvian Sol', code: 'PEN', symbol: 'S/.' }, language: 'Spanish', continent: 'South America', lat: -9.1900, lon: -75.0152 },
  { name: 'Trinidad and Tobago', code: 'tt', capital: 'Port of Spain', population: 1367000, area: 5128, currency: { name: 'Trinidad and Tobago Dollar', code: 'TTD', symbol: '$' }, language: 'English', continent: 'North America', lat: 10.6918, lon: -61.2225 },
  { name: 'United States', code: 'us', capital: 'Washington D.C.', population: 331449000, area: 9833517, currency: { name: 'US Dollar', code: 'USD', symbol: '$' }, language: 'English', continent: 'North America', lat: 37.0902, lon: -95.7129 },
  { name: 'Uruguay', code: 'uy', capital: 'Montevideo', population: 3474000, area: 176215, currency: { name: 'Uruguayan Peso', code: 'UYU', symbol: '$' }, language: 'Spanish', continent: 'South America', lat: -32.5228, lon: -55.7658 },
  { name: 'Venezuela', code: 've', capital: 'Caracas', population: 28436000, area: 916445, currency: { name: 'Venezuelan Bolívar', code: 'VES', symbol: 'Bs.' }, language: 'Spanish', continent: 'South America', lat: 6.4238, lon: -66.5897 },

  // Asia
  { name: 'Afghanistan', code: 'af', capital: 'Kabul', population: 40099000, area: 652230, currency: { name: 'Afghan Afghani', code: 'AFN', symbol: '؋' }, language: 'Pashto', continent: 'Asia', lat: 33.9391, lon: 67.7100 },
  { name: 'Bangladesh', code: 'bd', capital: 'Dhaka', population: 169356000, area: 147570, currency: { name: 'Bangladeshi Taka', code: 'BDT', symbol: '৳' }, language: 'Bengali', continent: 'Asia', lat: 23.6850, lon: 90.3563 },
  { name: 'Cambodia', code: 'kh', capital: 'Phnom Penh', population: 16589000, area: 181035, currency: { name: 'Cambodian Riel', code: 'KHR', symbol: '៛' }, language: 'Khmer', continent: 'Asia', lat: 12.5657, lon: 104.9910 },
  { name: 'China', code: 'cn', capital: 'Beijing', population: 1412600000, area: 9596960, currency: { name: 'Chinese Yuan', code: 'CNY', symbol: '¥' }, language: 'Mandarin', continent: 'Asia', lat: 35.8617, lon: 104.1954 },
  { name: 'India', code: 'in', capital: 'New Delhi', population: 1393409038, area: 3287263, currency: { name: 'Indian Rupee', code: 'INR', symbol: '₹' }, language: 'Hindi', continent: 'Asia', lat: 20.5937, lon: 78.9629 },
  { name: 'Indonesia', code: 'id', capital: 'Jakarta', population: 276362000, area: 1904569, currency: { name: 'Indonesian Rupiah', code: 'IDR', symbol: 'Rp' }, language: 'Indonesian', continent: 'Asia', lat: -0.7893, lon: 113.9213 },
  { name: 'Iran', code: 'ir', capital: 'Tehran', population: 85029000, area: 1648195, currency: { name: 'Iranian Rial', code: 'IRR', symbol: '﷼' }, language: 'Persian', continent: 'Asia', lat: 32.4279, lon: 53.6880 },
  { name: 'Iraq', code: 'iq', capital: 'Baghdad', population: 41179000, area: 438317, currency: { name: 'Iraqi Dinar', code: 'IQD', symbol: 'ع.د' }, language: 'Arabic', continent: 'Asia', lat: 33.2232, lon: 43.6793 },
  { name: 'Israel', code: 'il', capital: 'Jerusalem', population: 9364000, area: 20770, currency: { name: 'Israeli Shekel', code: 'ILS', symbol: '₪' }, language: 'Hebrew', continent: 'Asia', lat: 31.0461, lon: 34.8516 },
  { name: 'Japan', code: 'jp', capital: 'Tokyo', population: 125360000, area: 377930, currency: { name: 'Japanese Yen', code: 'JPY', symbol: '¥' }, language: 'Japanese', continent: 'Asia', lat: 36.2048, lon: 138.2529 },
  { name: 'Jordan', code: 'jo', capital: 'Amman', population: 10269000, area: 89342, currency: { name: 'Jordanian Dinar', code: 'JOD', symbol: 'JD' }, language: 'Arabic', continent: 'Asia', lat: 30.5852, lon: 36.2384 },
  { name: 'Kazakhstan', code: 'kz', capital: 'Nur-Sultan', population: 19000000, area: 2724900, currency: { name: 'Kazakhstani Tenge', code: 'KZT', symbol: '₸' }, language: 'Kazakh', continent: 'Asia', lat: 48.0196, lon: 66.9237 },
  { name: 'Kuwait', code: 'kw', capital: 'Kuwait City', population: 4270000, area: 17818, currency: { name: 'Kuwaiti Dinar', code: 'KWD', symbol: 'KD' }, language: 'Arabic', continent: 'Asia', lat: 29.3117, lon: 47.4818 },
  { name: 'Laos', code: 'la', capital: 'Vientiane', population: 7379000, area: 236800, currency: { name: 'Lao Kip', code: 'LAK', symbol: '₭' }, language: 'Lao', continent: 'Asia', lat: 19.8563, lon: 102.4955 },
  { name: 'Lebanon', code: 'lb', capital: 'Beirut', population: 6769000, area: 10452, currency: { name: 'Lebanese Pound', code: 'LBP', symbol: 'ل.ل' }, language: 'Arabic', continent: 'Asia', lat: 33.8547, lon: 35.8623 },
  { name: 'Malaysia', code: 'my', capital: 'Kuala Lumpur', population: 32776000, area: 329847, currency: { name: 'Malaysian Ringgit', code: 'MYR', symbol: 'RM' }, language: 'Malay', continent: 'Asia', lat: 4.2105, lon: 101.9758 },
  { name: 'Mongolia', code: 'mn', capital: 'Ulaanbaatar', population: 3347000, area: 1564116, currency: { name: 'Mongolian Tögrög', code: 'MNT', symbol: '₮' }, language: 'Mongolian', continent: 'Asia', lat: 46.8625, lon: 103.8467 },
  { name: 'Myanmar', code: 'mm', capital: 'Naypyidaw', population: 54409000, area: 676578, currency: { name: 'Myanmar Kyat', code: 'MMK', symbol: 'K' }, language: 'Burmese', continent: 'Asia', lat: 21.9162, lon: 95.9560 },
  { name: 'Nepal', code: 'np', capital: 'Kathmandu', population: 29609000, area: 147181, currency: { name: 'Nepalese Rupee', code: 'NPR', symbol: '₨' }, language: 'Nepali', continent: 'Asia', lat: 28.3949, lon: 84.1240 },
  { name: 'North Korea', code: 'kp', capital: 'Pyongyang', population: 25971000, area: 120538, currency: { name: 'North Korean Won', code: 'KPW', symbol: '₩' }, language: 'Korean', continent: 'Asia', lat: 40.3399, lon: 127.5101 },
  { name: 'Oman', code: 'om', capital: 'Muscat', population: 4491000, area: 309500, currency: { name: 'Omani Rial', code: 'OMR', symbol: 'ر.ع.' }, language: 'Arabic', continent: 'Asia', lat: 21.5126, lon: 55.9233 },
  { name: 'Pakistan', code: 'pk', capital: 'Islamabad', population: 220892000, area: 881913, currency: { name: 'Pakistani Rupee', code: 'PKR', symbol: '₨' }, language: 'Urdu', continent: 'Asia', lat: 30.3753, lon: 69.3451 },
  { name: 'Philippines', code: 'ph', capital: 'Manila', population: 110818000, area: 300000, currency: { name: 'Philippine Peso', code: 'PHP', symbol: '₱' }, language: 'Filipino', continent: 'Asia', lat: 12.8797, lon: 121.7740 },
  { name: 'Qatar', code: 'qa', capital: 'Doha', population: 2688000, area: 11586, currency: { name: 'Qatari Riyal', code: 'QAR', symbol: 'ر.ق' }, language: 'Arabic', continent: 'Asia', lat: 25.3548, lon: 51.1839 },
  { name: 'Saudi Arabia', code: 'sa', capital: 'Riyadh', population: 34814000, area: 2149690, currency: { name: 'Saudi Riyal', code: 'SAR', symbol: 'ر.س' }, language: 'Arabic', continent: 'Asia', lat: 23.8859, lon: 45.0792 },
  { name: 'Singapore', code: 'sg', capital: 'Singapore', population: 5850000, area: 710, currency: { name: 'Singapore Dollar', code: 'SGD', symbol: '$' }, language: 'English', continent: 'Asia', lat: 1.3521, lon: 103.8198 },
  { name: 'South Korea', code: 'kr', capital: 'Seoul', population: 51709000, area: 100210, currency: { name: 'South Korean Won', code: 'KRW', symbol: '₩' }, language: 'Korean', continent: 'Asia', lat: 35.9078, lon: 127.7669 },
  { name: 'Sri Lanka', code: 'lk', capital: 'Sri Jayawardenepura Kotte', population: 21919000, area: 65610, currency: { name: 'Sri Lankan Rupee', code: 'LKR', symbol: 'Rs' }, language: 'Sinhala', continent: 'Asia', lat: 7.8731, lon: 80.7718 },
  { name: 'Syria', code: 'sy', capital: 'Damascus', population: 20384000, area: 185180, currency: { name: 'Syrian Pound', code: 'SYP', symbol: '£' }, language: 'Arabic', continent: 'Asia', lat: 34.8021, lon: 38.9968 },
  { name: 'Taiwan', code: 'tw', capital: 'Taipei', population: 23571000, area: 36193, currency: { name: 'New Taiwan Dollar', code: 'TWD', symbol: '$' }, language: 'Mandarin', continent: 'Asia', lat: 23.6978, lon: 120.9605 },
  { name: 'Tajikistan', code: 'tj', capital: 'Dushanbe', population: 9537000, area: 143100, currency: { name: 'Tajikistani Somoni', code: 'TJS', symbol: 'SM' }, language: 'Tajik', continent: 'Asia', lat: 38.8610, lon: 71.2761 },
  { name: 'Thailand', code: 'th', capital: 'Bangkok', population: 69950000, area: 513120, currency: { name: 'Thai Baht', code: 'THB', symbol: '฿' }, language: 'Thai', continent: 'Asia', lat: 15.8700, lon: 100.9925 },
  { name: 'Turkey', code: 'tr', capital: 'Ankara', population: 84339000, area: 783356, currency: { name: 'Turkish Lira', code: 'TRY', symbol: '₺' }, language: 'Turkish', continent: 'Asia', lat: 38.9637, lon: 35.2433 },
  { name: 'Turkmenistan', code: 'tm', capital: 'Ashgabat', population: 6118000, area: 488100, currency: { name: 'Turkmenistani Manat', code: 'TMT', symbol: 'T' }, language: 'Turkmen', continent: 'Asia', lat: 38.9697, lon: 59.5563 },
  { name: 'United Arab Emirates', code: 'ae', capital: 'Abu Dhabi', population: 9770000, area: 83600, currency: { name: 'UAE Dirham', code: 'AED', symbol: 'د.إ' }, language: 'Arabic', continent: 'Asia', lat: 23.4241, lon: 53.8478 },
  { name: 'Uzbekistan', code: 'uz', capital: 'Tashkent', population: 35300000, area: 448978, currency: { name: 'Uzbekistani Soʻm', code: 'UZS', symbol: 'soʻm' }, language: 'Uzbek', continent: 'Asia', lat: 41.3775, lon: 64.5853 },
  { name: 'Vietnam', code: 'vn', capital: 'Hanoi', population: 97339000, area: 331212, currency: { name: 'Vietnamese Đồng', code: 'VND', symbol: '₫' }, language: 'Vietnamese', continent: 'Asia', lat: 14.0583, lon: 108.2772 },
  { name: 'Yemen', code: 'ye', capital: 'Sana\'a', population: 33696000, area: 527968, currency: { name: 'Yemeni Rial', code: 'YER', symbol: '﷼' }, language: 'Arabic', continent: 'Asia', lat: 15.5527, lon: 48.5164 },

  // Europe
  { name: 'Albania', code: 'al', capital: 'Tirana', population: 2837000, area: 28748, currency: { name: 'Albanian Lek', code: 'ALL', symbol: 'L' }, language: 'Albanian', continent: 'Europe', lat: 41.1533, lon: 20.1683 },
  { name: 'Austria', code: 'at', capital: 'Vienna', population: 9043000, area: 83871, currency: { name: 'Euro', code: 'EUR', symbol: '€' }, language: 'German', continent: 'Europe', lat: 47.5162, lon: 14.5501 },
  { name: 'Belarus', code: 'by', capital: 'Minsk', population: 9449000, area: 207600, currency: { name: 'Belarusian Ruble', code: 'BYN', symbol: 'Br' }, language: 'Belarusian', continent: 'Europe', lat: 53.7098, lon: 27.9534 },
  { name: 'Belgium', code: 'be', capital: 'Brussels', population: 11590000, area: 30528, currency: { name: 'Euro', code: 'EUR', symbol: '€' }, language: 'Dutch', continent: 'Europe', lat: 50.5039, lon: 4.4699 },
  { name: 'Bulgaria', code: 'bg', capital: 'Sofia', population: 6520000, area: 110879, currency: { name: 'Bulgarian Lev', code: 'BGN', symbol: 'лв' }, language: 'Bulgarian', continent: 'Europe', lat: 42.7339, lon: 25.4858 },
  { name: 'Croatia', code: 'hr', capital: 'Zagreb', population: 4047000, area: 56594, currency: { name: 'Euro', code: 'EUR', symbol: '€' }, language: 'Croatian', continent: 'Europe', lat: 45.1000, lon: 15.2000 },
  { name: 'Czech Republic', code: 'cz', capital: 'Prague', population: 10900000, area: 78867, currency: { name: 'Czech Koruna', code: 'CZK', symbol: 'Kč' }, language: 'Czech', continent: 'Europe', lat: 49.8175, lon: 15.4730 },
  { name: 'Denmark', code: 'dk', capital: 'Copenhagen', population: 5831000, area: 42924, currency: { name: 'Danish Krone', code: 'DKK', symbol: 'kr' }, language: 'Danish', continent: 'Europe', lat: 56.2639, lon: 9.5018 },
  { name: 'Finland', code: 'fi', capital: 'Helsinki', population: 5533000, area: 338145, currency: { name: 'Euro', code: 'EUR', symbol: '€' }, language: 'Finnish', continent: 'Europe', lat: 61.9241, lon: 25.7482 },
  { name: 'France', code: 'fr', capital: 'Paris', population: 67757000, area: 551695, currency: { name: 'Euro', code: 'EUR', symbol: '€' }, language: 'French', continent: 'Europe', lat: 46.2276, lon: 2.2137 },
  { name: 'Germany', code: 'de', capital: 'Berlin', population: 83240000, area: 357114, currency: { name: 'Euro', code: 'EUR', symbol: '€' }, language: 'German', continent: 'Europe', lat: 51.1657, lon: 10.4515 },
  { name: 'Greece', code: 'gr', capital: 'Athens', population: 10724000, area: 131957, currency: { name: 'Euro', code: 'EUR', symbol: '€' }, language: 'Greek', continent: 'Europe', lat: 39.0742, lon: 21.8243 },
  { name: 'Hungary', code: 'hu', capital: 'Budapest', population: 9749000, area: 93028, currency: { name: 'Hungarian Forint', code: 'HUF', symbol: 'Ft' }, language: 'Hungarian', continent: 'Europe', lat: 47.1625, lon: 19.5033 },
  { name: 'Ireland', code: 'ie', capital: 'Dublin', population: 5123000, area: 70273, currency: { name: 'Euro', code: 'EUR', symbol: '€' }, language: 'English', continent: 'Europe', lat: 53.4129, lon: -8.2439 },
  { name: 'Italy', code: 'it', capital: 'Rome', population: 60317000, area: 301340, currency: { name: 'Euro', code: 'EUR', symbol: '€' }, language: 'Italian', continent: 'Europe', lat: 41.8719, lon: 12.5674 },
  { name: 'Netherlands', code: 'nl', capital: 'Amsterdam', population: 17590000, area: 41543, currency: { name: 'Euro', code: 'EUR', symbol: '€' }, language: 'Dutch', continent: 'Europe', lat: 52.1326, lon: 5.2913 },
  { name: 'Norway', code: 'no', capital: 'Oslo', population: 5391000, area: 385207, currency: { name: 'Norwegian Krone', code: 'NOK', symbol: 'kr' }, language: 'Norwegian', continent: 'Europe', lat: 60.4720, lon: 8.4689 },
  { name: 'Poland', code: 'pl', capital: 'Warsaw', population: 37950000, area: 312696, currency: { name: 'Polish Złoty', code: 'PLN', symbol: 'zł' }, language: 'Polish', continent: 'Europe', lat: 51.9194, lon: 19.1451 },
  { name: 'Portugal', code: 'pt', capital: 'Lisbon', population: 10290000, area: 92212, currency: { name: 'Euro', code: 'EUR', symbol: '€' }, language: 'Portuguese', continent: 'Europe', lat: 39.3999, lon: -8.2245 },
  { name: 'Romania', code: 'ro', capital: 'Bucharest', population: 19237000, area: 238397, currency: { name: 'Romanian Leu', code: 'RON', symbol: 'lei' }, language: 'Romanian', continent: 'Europe', lat: 45.9432, lon: 24.9668 },
  { name: 'Russia', code: 'ru', capital: 'Moscow', population: 145478000, area: 17098242, currency: { name: 'Russian Ruble', code: 'RUB', symbol: '₽' }, language: 'Russian', continent: 'Europe', lat: 61.5240, lon: 105.3188 },
  { name: 'Serbia', code: 'rs', capital: 'Belgrade', population: 6805000, area: 77474, currency: { name: 'Serbian Dinar', code: 'RSD', symbol: 'дин' }, language: 'Serbian', continent: 'Europe', lat: 44.0165, lon: 21.0059 },
  { name: 'Slovakia', code: 'sk', capital: 'Bratislava', population: 5460000, area: 49035, currency: { name: 'Euro', code: 'EUR', symbol: '€' }, language: 'Slovak', continent: 'Europe', lat: 48.6690, lon: 19.6990 },
  { name: 'Spain', code: 'es', capital: 'Madrid', population: 47351000, area: 505990, currency: { name: 'Euro', code: 'EUR', symbol: '€' }, language: 'Spanish', continent: 'Europe', lat: 40.4637, lon: -3.7492 },
  { name: 'Sweden', code: 'se', capital: 'Stockholm', population: 10353000, area: 450295, currency: { name: 'Swedish Krona', code: 'SEK', symbol: 'kr' }, language: 'Swedish', continent: 'Europe', lat: 60.1282, lon: 18.6435 },
  { name: 'Switzerland', code: 'ch', capital: 'Bern', population: 8703000, area: 41285, currency: { name: 'Swiss Franc', code: 'CHF', symbol: 'Fr' }, language: 'German', continent: 'Europe', lat: 46.8182, lon: 8.2275 },
  { name: 'Ukraine', code: 'ua', capital: 'Kyiv', population: 43469000, area: 603550, currency: { name: 'Ukrainian Hryvnia', code: 'UAH', symbol: '₴' }, language: 'Ukrainian', continent: 'Europe', lat: 48.3794, lon: 31.1656 },
  { name: 'United Kingdom', code: 'gb', capital: 'London', population: 67215000, area: 242495, currency: { name: 'British Pound', code: 'GBP', symbol: '£' }, language: 'English', continent: 'Europe', lat: 55.3781, lon: -3.4360 },

  // Oceania
  { name: 'Australia', code: 'au', capital: 'Canberra', population: 25921000, area: 7692024, currency: { name: 'Australian Dollar', code: 'AUD', symbol: '$' }, language: 'English', continent: 'Oceania', lat: -25.2744, lon: 133.7751 },
  { name: 'Fiji', code: 'fj', capital: 'Suva', population: 896000, area: 18272, currency: { name: 'Fijian Dollar', code: 'FJD', symbol: '$' }, language: 'English', continent: 'Oceania', lat: -17.7134, lon: 178.0650 },
  { name: 'New Zealand', code: 'nz', capital: 'Wellington', population: 5084000, area: 270467, currency: { name: 'New Zealand Dollar', code: 'NZD', symbol: '$' }, language: 'English', continent: 'Oceania', lat: -40.9006, lon: 174.8860 },
  { name: 'Papua New Guinea', code: 'pg', capital: 'Port Moresby', population: 9119000, area: 462840, currency: { name: 'Papua New Guinean Kina', code: 'PGK', symbol: 'K' }, language: 'English', continent: 'Oceania', lat: -6.3150, lon: 143.9555 },
  { name: 'Samoa', code: 'ws', capital: 'Apia', population: 217000, area: 2831, currency: { name: 'Samoan Tālā', code: 'WST', symbol: 'T' }, language: 'Samoan', continent: 'Oceania', lat: -13.7590, lon: -172.1046 },
  { name: 'Vanuatu', code: 'vu', capital: 'Port Vila', population: 307000, area: 12189, currency: { name: 'Vanuatu Vatu', code: 'VUV', symbol: 'Vt' }, language: 'Bislama', continent: 'Oceania', lat: -15.3767, lon: 166.9592 },
];

// Build a lookup by code
export const COUNTRIES_BY_CODE: Record<string, Country> = {};
COUNTRIES.forEach(c => { COUNTRIES_BY_CODE[c.code] = c; });

// Ranked search: exact name > name starts with > capital starts with > name contains > capital contains
export function searchCountries(query: string): Country[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const scored: { c: Country; score: number }[] = [];
  COUNTRIES.forEach(c => {
    const n = c.name.toLowerCase();
    const k = c.capital.toLowerCase();
    let score = 0;
    if (n === q)             score = 100;
    else if (n.startsWith(q)) score = 80;
    else if (k === q)         score = 70;
    else if (k.startsWith(q)) score = 60;
    else if (n.includes(q))   score = 40;
    else if (k.includes(q))   score = 30;
    if (score > 0) scored.push({ c, score });
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, 10).map(r => r.c);
}

// Find nearest country to lat/lon
export function findNearestCountry(lat: number, lon: number): Country | null {
  let nearest: Country | null = null;
  let minDist = Infinity;
  COUNTRIES.forEach(c => {
    const dlat = c.lat - lat;
    const dlon = c.lon - lon;
    const dist = dlat * dlat + dlon * dlon;
    if (dist < minDist) { minDist = dist; nearest = c; }
  });
  return nearest;
}

export function formatPopulation(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export function formatPopulationFull(n: number): string {
  return n.toLocaleString();
}

export function formatArea(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M km²`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K km²`;
  return `${n.toLocaleString()} km²`;
}

export function formatAreaFull(n: number): string {
  return `${n.toLocaleString()} km²`;
}
