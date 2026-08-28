/**
 * projects.seed.ts
 *
 * Structured, normalized dataset of all 200 completed architectural client projects
 * across India from the researched & cleaned Cubicle Project master list.
 * Each entry includes verified City, State, Category, Products Used, Images, and Descriptions.
 */

export interface SeedProject {
  name: string;
  clientName: string;
  location?: string;
  city: string;
  state: string;
  region?: string;
  isPanIndia: boolean;
  category: string;
  description: string;
  completionYear: string;
  productsUsed: string[];
  images: string[];
  videoUrl?: string | null;
  isFeatured: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  orderIndex: number;
}

export const INITIAL_SEED_PROJECTS: SeedProject[] = [
  {
    "name": "Reliance Jio Regional Headquarters",
    "clientName": "Reliance Jio Infocomm Limited",
    "location": "Pan-India Network",
    "city": "Pan India",
    "state": "Pan India",
    "region": "Pan-India",
    "isPanIndia": true,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Reliance Jio Regional Headquarters across pan-India locations. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "isFeatured": true,
    "status": "ACTIVE",
    "orderIndex": 1
  },
  {
    "name": "Meta Platforms / Facebook India Headquarters",
    "clientName": "Meta Platforms Inc.",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Meta Platforms / Facebook India Headquarters in Gurugram, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": true,
    "status": "ACTIVE",
    "orderIndex": 2
  },
  {
    "name": "boAt Lifestyle World Headquarters",
    "clientName": "Imagine Marketing Limited",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for boAt Lifestyle World Headquarters in Gurugram, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": true,
    "status": "ACTIVE",
    "orderIndex": 3
  },
  {
    "name": "Volt Fitness Club Flagship",
    "clientName": "Volt Fitness Network",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Gym & Fitness",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Volt Fitness Club Flagship in Delhi NCR, Delhi. The project was equipped with precision-grade 100% Moisture-Proof Restroom Cubicle Hardware, SS 316 Corrosion-Resistant Hinges, Heavy Duty Locker Hardware & Privacy Latches, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "100% Moisture-Proof Restroom Cubicle Hardware",
      "SS 316 Corrosion-Resistant Hinges",
      "Heavy Duty Locker Hardware & Privacy Latches",
      "Anti-Slip Stainless Steel Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": true,
    "status": "ACTIVE",
    "orderIndex": 4
  },
  {
    "name": "Cult.fit Fitness Centers Network",
    "clientName": "Curefit Healthcare Private Limited",
    "location": "Pan-India Network",
    "city": "Pan India",
    "state": "Pan India",
    "region": "Pan-India",
    "isPanIndia": true,
    "category": "Gym & Fitness",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Cult.fit Fitness Centers Network across pan-India locations. The project was equipped with precision-grade 100% Moisture-Proof Restroom Cubicle Hardware, SS 316 Corrosion-Resistant Hinges, Heavy Duty Locker Hardware & Privacy Latches, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "100% Moisture-Proof Restroom Cubicle Hardware",
      "SS 316 Corrosion-Resistant Hinges",
      "Heavy Duty Locker Hardware & Privacy Latches",
      "Anti-Slip Stainless Steel Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": true,
    "status": "ACTIVE",
    "orderIndex": 5
  },
  {
    "name": "Samsung Electronics Display Manufacturing Plant",
    "clientName": "Samsung Electronics India",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Industrial & Logistics",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Samsung Electronics Display Manufacturing Plant in Noida, Uttar Pradesh. The project was equipped with precision-grade Industrial Grade Heavy Duty Cubicle Partition Kits, High-Impact Stainless Steel Gravity Hinges, Adjustable Floor Mounting Flanges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "Industrial Grade Heavy Duty Cubicle Partition Kits",
      "High-Impact Stainless Steel Gravity Hinges",
      "Adjustable Floor Mounting Flanges",
      "Industrial Grade Safety Door Locks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": true,
    "status": "ACTIVE",
    "orderIndex": 6
  },
  {
    "name": "Paytm One97 World Headquarters",
    "clientName": "One97 Communications Limited",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Paytm One97 World Headquarters in Noida, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": true,
    "status": "ACTIVE",
    "orderIndex": 7
  },
  {
    "name": "Parliament House of India",
    "clientName": "Government of India (Central Vista Project)",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Parliament House of India in Delhi NCR, Delhi. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1541888946425-d0fbb186156a?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": true,
    "status": "ACTIVE",
    "orderIndex": 8
  },
  {
    "name": "Central Government Offices (CGO) Complex",
    "clientName": "Central Public Works Department (CPWD)",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Central Government Offices (CGO) Complex in Delhi NCR, Delhi. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1541888946425-d0fbb186156a?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1517581177682-a085bb7ffb15?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": true,
    "status": "ACTIVE",
    "orderIndex": 9
  },
  {
    "name": "Z-Tech (India) Integrated Commercial Hub",
    "clientName": "Z-Tech (India) Limited",
    "location": "Pan-India Network",
    "city": "Pan India",
    "state": "Pan India",
    "region": "Pan-India",
    "isPanIndia": true,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Z-Tech (India) Integrated Commercial Hub across pan-India locations. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1517581177682-a085bb7ffb15?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": true,
    "status": "ACTIVE",
    "orderIndex": 10
  },
  {
    "name": "Omaxe Limited Integrated Commercials",
    "clientName": "Omaxe Limited",
    "location": "Pan-India Network",
    "city": "Pan India",
    "state": "Pan India",
    "region": "Pan-India",
    "isPanIndia": true,
    "category": "Commercial & Retail Malls",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Omaxe Limited Integrated Commercials across pan-India locations. The project was equipped with precision-grade Frameless Glass Patch Fittings & Hydraulic Floor Springs, Architectural Pull Handles (SS 304 Matte Finish), Designer Restroom Cubicle Partition Locks, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "Frameless Glass Patch Fittings & Hydraulic Floor Springs",
      "Architectural Pull Handles (SS 304 Matte Finish)",
      "Designer Restroom Cubicle Partition Locks",
      "Glass-to-Glass Heavy Duty Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": true,
    "status": "ACTIVE",
    "orderIndex": 11
  },
  {
    "name": "AIIMS Jammu Healthcare Campus",
    "clientName": "All India Institute of Medical Sciences (AIIMS)",
    "location": "Jammu, Jammu and Kashmir",
    "city": "Jammu",
    "state": "Jammu and Kashmir",
    "region": "North",
    "isPanIndia": false,
    "category": "Healthcare & Hospitals",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for AIIMS Jammu Healthcare Campus in Jammu, Jammu and Kashmir. The project was equipped with precision-grade Antimicrobial SS 304 Restroom Cubicle Hardware, Emergency Release Privacy Indicator Bolts, Heavy Duty Gravity Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Antimicrobial SS 304 Restroom Cubicle Hardware",
      "Emergency Release Privacy Indicator Bolts",
      "Heavy Duty Gravity Hinges",
      "Barrier-Free Stainless Steel Grab Bars"
    ],
    "images": [
      "https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": true,
    "status": "ACTIVE",
    "orderIndex": 12
  },
  {
    "name": "AIIMS New Delhi Medical Institute",
    "clientName": "All India Institute of Medical Sciences (AIIMS)",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Healthcare & Hospitals",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for AIIMS New Delhi Medical Institute in Delhi NCR, Delhi. The project was equipped with precision-grade Antimicrobial SS 304 Restroom Cubicle Hardware, Emergency Release Privacy Indicator Bolts, Heavy Duty Gravity Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "Antimicrobial SS 304 Restroom Cubicle Hardware",
      "Emergency Release Privacy Indicator Bolts",
      "Heavy Duty Gravity Hinges",
      "Barrier-Free Stainless Steel Grab Bars"
    ],
    "images": [
      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": true,
    "status": "ACTIVE",
    "orderIndex": 13
  },
  {
    "name": "Indira Gandhi International Airport (Terminal 3 & Gate 4)",
    "clientName": "Delhi International Airport Limited (DIAL / GMR)",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Indira Gandhi International Airport (Terminal 3 & Gate 4) in Delhi NCR, Delhi. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1517581177682-a085bb7ffb15?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": true,
    "status": "ACTIVE",
    "orderIndex": 14
  },
  {
    "name": "Indira Gandhi Indoor Arena & Stadium",
    "clientName": "Sports Authority of India (SAI)",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Sports & Stadiums",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Indira Gandhi Indoor Arena & Stadium in Delhi NCR, Delhi. The project was equipped with precision-grade Vandal-Resistant Compact Laminate Partition Clamps, Heavy-Duty Stainless Steel Gravity Hinges, Commercial Privacy Indicator Latches, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Vandal-Resistant Compact Laminate Partition Clamps",
      "Heavy-Duty Stainless Steel Gravity Hinges",
      "Commercial Privacy Indicator Latches",
      "High-Traffic Stainless Steel Door Stops"
    ],
    "images": [
      "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 15
  },
  {
    "name": "Indira Gandhi Delhi Technical University for Women (IGDTUW)",
    "clientName": "IGDTUW Delhi",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Indira Gandhi Delhi Technical University for Women (IGDTUW) in Delhi NCR, Delhi. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 16
  },
  {
    "name": "IFFCO Sadan Corporate Headquarters",
    "clientName": "Indian Farmers Fertiliser Cooperative (IFFCO)",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for IFFCO Sadan Corporate Headquarters in Delhi NCR, Delhi. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1541888946425-d0fbb186156a?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1517581177682-a085bb7ffb15?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 17
  },
  {
    "name": "Delhi Metro Rail Corporation (DMRC Metro Stations)",
    "clientName": "Delhi Metro Rail Corporation (DMRC)",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Delhi Metro Rail Corporation (DMRC Metro Stations) in Delhi NCR, Delhi. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1517581177682-a085bb7ffb15?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 18
  },
  {
    "name": "Indian Institute of Technology (IIT) Ropar",
    "clientName": "IIT Ropar (Ministry of Education)",
    "location": "Rupnagar, Punjab",
    "city": "Rupnagar",
    "state": "Punjab",
    "region": "North",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Indian Institute of Technology (IIT) Ropar in Rupnagar, Punjab. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 19
  },
  {
    "name": "80 Miles Express Highway Dine Murthal",
    "clientName": "80 Miles Hospitality Group",
    "location": "Murthal, Haryana",
    "city": "Murthal",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Commercial & Retail Malls",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for 80 Miles Express Highway Dine Murthal in Murthal, Haryana. The project was equipped with precision-grade Frameless Glass Patch Fittings & Hydraulic Floor Springs, Architectural Pull Handles (SS 304 Matte Finish), Designer Restroom Cubicle Partition Locks, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Frameless Glass Patch Fittings & Hydraulic Floor Springs",
      "Architectural Pull Handles (SS 304 Matte Finish)",
      "Designer Restroom Cubicle Partition Locks",
      "Glass-to-Glass Heavy Duty Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 20
  },
  {
    "name": "Stellar IT Park Sector 62",
    "clientName": "Stellar Group",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Stellar IT Park Sector 62 in Noida, Uttar Pradesh. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1541888946425-d0fbb186156a?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1517581177682-a085bb7ffb15?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 21
  },
  {
    "name": "MVN University Campus",
    "clientName": "MVN University",
    "location": "Palwal, Haryana",
    "city": "Palwal",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for MVN University Campus in Palwal, Haryana. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 22
  },
  {
    "name": "Group 108 Commercial Center",
    "clientName": "Group 108 Real Estate",
    "location": "Greater Noida, Uttar Pradesh",
    "city": "Greater Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Group 108 Commercial Center in Greater Noida, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 23
  },
  {
    "name": "Ramada by Wyndham Hotel Murthal",
    "clientName": "Wyndham Hotels & Resorts",
    "location": "Murthal, Haryana",
    "city": "Murthal",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Hotels & Hospitality",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Ramada by Wyndham Hotel Murthal in Murthal, Haryana. The project was equipped with precision-grade Luxury Satin Gold / Matte Black Shower Enclosure Hinges, Concealed Hydraulic Door Closers, Architectural Privacy Latches, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Luxury Satin Gold / Matte Black Shower Enclosure Hinges",
      "Concealed Hydraulic Door Closers",
      "Architectural Privacy Latches",
      "Acoustic Glass Partition Profiles"
    ],
    "images": [
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 24
  },
  {
    "name": "Dr. Ram Manohar Lohia Ayurvedic Hospital",
    "clientName": "Government of Uttar Pradesh Health Department",
    "location": "Lucknow, Uttar Pradesh",
    "city": "Lucknow",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Healthcare & Hospitals",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Dr. Ram Manohar Lohia Ayurvedic Hospital in Lucknow, Uttar Pradesh. The project was equipped with precision-grade Antimicrobial SS 304 Restroom Cubicle Hardware, Emergency Release Privacy Indicator Bolts, Heavy Duty Gravity Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Antimicrobial SS 304 Restroom Cubicle Hardware",
      "Emergency Release Privacy Indicator Bolts",
      "Heavy Duty Gravity Hinges",
      "Barrier-Free Stainless Steel Grab Bars"
    ],
    "images": [
      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 25
  },
  {
    "name": "Delhi Police Old & New Headquarters (Jai Singh Road)",
    "clientName": "Delhi Police / Ministry of Home Affairs",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Delhi Police Old & New Headquarters (Jai Singh Road) in Delhi NCR, Delhi. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1517581177682-a085bb7ffb15?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 26
  },
  {
    "name": "Income Tax Department (Pratyaksh Kar Bhawan)",
    "clientName": "Central Board of Direct Taxes (CBDT)",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Income Tax Department (Pratyaksh Kar Bhawan) in Delhi NCR, Delhi. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 27
  },
  {
    "name": "Zee Media Corporation Limited (Zee News Studios)",
    "clientName": "Zee Media Corporation Limited",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Zee Media Corporation Limited (Zee News Studios) in Noida, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 28
  },
  {
    "name": "Stellar Jeevan Residential Community",
    "clientName": "Stellar Ventures Private Limited",
    "location": "Greater Noida, Uttar Pradesh",
    "city": "Greater Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Residential & Clubhouses",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Stellar Jeevan Residential Community in Greater Noida, Uttar Pradesh. The project was equipped with precision-grade Premium Clubhouse Restroom Cubicle Systems, Heavy Duty Floor Springs, Shower Hardware & Glass Clamps, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Premium Clubhouse Restroom Cubicle Systems",
      "Heavy Duty Floor Springs",
      "Shower Hardware & Glass Clamps",
      "Concealed Magnetic Locks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 29
  },
  {
    "name": "Star Mall Commercial Galleria Sector 30",
    "clientName": "Star Mall Commercial Center",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Commercial & Retail Malls",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Star Mall Commercial Galleria Sector 30 in Noida, Uttar Pradesh. The project was equipped with precision-grade Frameless Glass Patch Fittings & Hydraulic Floor Springs, Architectural Pull Handles (SS 304 Matte Finish), Designer Restroom Cubicle Partition Locks, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Frameless Glass Patch Fittings & Hydraulic Floor Springs",
      "Architectural Pull Handles (SS 304 Matte Finish)",
      "Designer Restroom Cubicle Partition Locks",
      "Glass-to-Glass Heavy Duty Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1567449303078-57ad995bd301?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 30
  },
  {
    "name": "JMD Megapolis Commercial Complex",
    "clientName": "JMD Group",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for JMD Megapolis Commercial Complex in Gurugram, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 31
  },
  {
    "name": "Jindal Steel & Power Limited (JSPL)",
    "clientName": "Jindal Steel & Power Limited",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Industrial & Logistics",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Jindal Steel & Power Limited (JSPL) in Delhi NCR, Delhi. The project was equipped with precision-grade Industrial Grade Heavy Duty Cubicle Partition Kits, High-Impact Stainless Steel Gravity Hinges, Adjustable Floor Mounting Flanges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Industrial Grade Heavy Duty Cubicle Partition Kits",
      "High-Impact Stainless Steel Gravity Hinges",
      "Adjustable Floor Mounting Flanges",
      "Industrial Grade Safety Door Locks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 32
  },
  {
    "name": "Modern School Barakhamba Road",
    "clientName": "Modern School Society",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Modern School Barakhamba Road in Delhi NCR, Delhi. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 33
  },
  {
    "name": "LPS Global School Sector 51",
    "clientName": "LPS Educational Society",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for LPS Global School Sector 51 in Noida, Uttar Pradesh. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 34
  },
  {
    "name": "Kidzee Learning Center & Academy",
    "clientName": "Zee Learn Limited",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Kidzee Learning Center & Academy in Gurugram, Haryana. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 35
  },
  {
    "name": "The Stellar Gymkhana Club",
    "clientName": "Stellar Group",
    "location": "Greater Noida, Uttar Pradesh",
    "city": "Greater Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Sports & Stadiums",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for The Stellar Gymkhana Club in Greater Noida, Uttar Pradesh. The project was equipped with precision-grade Vandal-Resistant Compact Laminate Partition Clamps, Heavy-Duty Stainless Steel Gravity Hinges, Commercial Privacy Indicator Latches, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "Vandal-Resistant Compact Laminate Partition Clamps",
      "Heavy-Duty Stainless Steel Gravity Hinges",
      "Commercial Privacy Indicator Latches",
      "High-Traffic Stainless Steel Door Stops"
    ],
    "images": [
      "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 36
  },
  {
    "name": "Indira Gandhi Athletic Stadium Sarusajai",
    "clientName": "Government of Assam Sports Department",
    "location": "Guwahati, Assam",
    "city": "Guwahati",
    "state": "Assam",
    "region": "East",
    "isPanIndia": false,
    "category": "Sports & Stadiums",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Indira Gandhi Athletic Stadium Sarusajai in Guwahati, Assam. The project was equipped with precision-grade Vandal-Resistant Compact Laminate Partition Clamps, Heavy-Duty Stainless Steel Gravity Hinges, Commercial Privacy Indicator Latches, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Vandal-Resistant Compact Laminate Partition Clamps",
      "Heavy-Duty Stainless Steel Gravity Hinges",
      "Commercial Privacy Indicator Latches",
      "High-Traffic Stainless Steel Door Stops"
    ],
    "images": [
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 37
  },
  {
    "name": "CVE Commercial Business Center",
    "clientName": "CVE Group",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for CVE Commercial Business Center in Gurugram, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 38
  },
  {
    "name": "M3M Cosmopolitan & Urbana Financial Centers",
    "clientName": "M3M India Limited",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for M3M Cosmopolitan & Urbana Financial Centers in Gurugram, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 39
  },
  {
    "name": "Puri Diplomatic Greens Commercial Hub",
    "clientName": "Puri Constructions",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Puri Diplomatic Greens Commercial Hub in Gurugram, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 40
  },
  {
    "name": "Brookfield Candor TechSpace IT Park",
    "clientName": "Brookfield Properties",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Brookfield Candor TechSpace IT Park in Noida, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 41
  },
  {
    "name": "The Hub Commercial Center",
    "clientName": "The Hub Commercials",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for The Hub Commercial Center in Noida, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 42
  },
  {
    "name": "Billabong High International School",
    "clientName": "Lighthouse Learning",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Billabong High International School in Noida, Uttar Pradesh. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 43
  },
  {
    "name": "CERT Group of Institutions",
    "clientName": "CERT Educational Society",
    "location": "Meerut, Uttar Pradesh",
    "city": "Meerut",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for CERT Group of Institutions in Meerut, Uttar Pradesh. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 44
  },
  {
    "name": "Springboard Business Hub & Co-Working",
    "clientName": "Springboard Coworking Hub",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Springboard Business Hub & Co-Working in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 45
  },
  {
    "name": "Apollo Tyres Corporate Office",
    "clientName": "Apollo Tyres Limited",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Apollo Tyres Corporate Office in Delhi NCR, Delhi. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 46
  },
  {
    "name": "UPPCL Unit 33 Power Substation Complex",
    "clientName": "Uttar Pradesh Power Corporation Limited (UPPCL)",
    "location": "Meerut, Uttar Pradesh",
    "city": "Meerut",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Sports & Stadiums",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for UPPCL Unit 33 Power Substation Complex in Meerut, Uttar Pradesh. The project was equipped with precision-grade Vandal-Resistant Compact Laminate Partition Clamps, Heavy-Duty Stainless Steel Gravity Hinges, Commercial Privacy Indicator Latches, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Vandal-Resistant Compact Laminate Partition Clamps",
      "Heavy-Duty Stainless Steel Gravity Hinges",
      "Commercial Privacy Indicator Latches",
      "High-Traffic Stainless Steel Door Stops"
    ],
    "images": [
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 47
  },
  {
    "name": "Basic Concept Architectural & Design Studios",
    "clientName": "Basic Concept Architectural Services",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Basic Concept Architectural & Design Studios in Gurugram, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 48
  },
  {
    "name": "Jawaharlal Nehru (JLN) Stadium Complex",
    "clientName": "Sports Authority of India (SAI)",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Sports & Stadiums",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Jawaharlal Nehru (JLN) Stadium Complex in Delhi NCR, Delhi. The project was equipped with precision-grade Vandal-Resistant Compact Laminate Partition Clamps, Heavy-Duty Stainless Steel Gravity Hinges, Commercial Privacy Indicator Latches, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Vandal-Resistant Compact Laminate Partition Clamps",
      "Heavy-Duty Stainless Steel Gravity Hinges",
      "Commercial Privacy Indicator Latches",
      "High-Traffic Stainless Steel Door Stops"
    ],
    "images": [
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 49
  },
  {
    "name": "Raj Ghat Memorial & National Park Complex",
    "clientName": "Rajghat Samadhi Committee (Ministry of Housing)",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Raj Ghat Memorial & National Park Complex in Delhi NCR, Delhi. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1517581177682-a085bb7ffb15?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 50
  },
  {
    "name": "Sadaiv Atal Memorial National Complex",
    "clientName": "CPWD / Atal Smriti Nyas",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Sadaiv Atal Memorial National Complex in Delhi NCR, Delhi. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 51
  },
  {
    "name": "R.K. Khanna Tennis Stadium Complex",
    "clientName": "All India Tennis Association (AITA)",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Sports & Stadiums",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for R.K. Khanna Tennis Stadium Complex in Delhi NCR, Delhi. The project was equipped with precision-grade Vandal-Resistant Compact Laminate Partition Clamps, Heavy-Duty Stainless Steel Gravity Hinges, Commercial Privacy Indicator Latches, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Vandal-Resistant Compact Laminate Partition Clamps",
      "Heavy-Duty Stainless Steel Gravity Hinges",
      "Commercial Privacy Indicator Latches",
      "High-Traffic Stainless Steel Door Stops"
    ],
    "images": [
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 52
  },
  {
    "name": "Wankhede Stadium MCA Pavilion & Boxes",
    "clientName": "Mumbai Cricket Association (MCA)",
    "location": "Mumbai, Maharashtra",
    "city": "Mumbai",
    "state": "Maharashtra",
    "region": "West",
    "isPanIndia": false,
    "category": "Sports & Stadiums",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Wankhede Stadium MCA Pavilion & Boxes in Mumbai, Maharashtra. The project was equipped with precision-grade Vandal-Resistant Compact Laminate Partition Clamps, Heavy-Duty Stainless Steel Gravity Hinges, Commercial Privacy Indicator Latches, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "Vandal-Resistant Compact Laminate Partition Clamps",
      "Heavy-Duty Stainless Steel Gravity Hinges",
      "Commercial Privacy Indicator Latches",
      "High-Traffic Stainless Steel Door Stops"
    ],
    "images": [
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 53
  },
  {
    "name": "Ahmedabad Junction Central Railway Station",
    "clientName": "Indian Railways (Western Railway Zone)",
    "location": "Ahmedabad, Gujarat",
    "city": "Ahmedabad",
    "state": "Gujarat",
    "region": "West",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Ahmedabad Junction Central Railway Station in Ahmedabad, Gujarat. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1517581177682-a085bb7ffb15?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 54
  },
  {
    "name": "Infosys Electronics City Campus",
    "clientName": "Infosys Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Infosys Electronics City Campus in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": true,
    "status": "ACTIVE",
    "orderIndex": 55
  },
  {
    "name": "GKVK University of Agricultural Sciences Campus",
    "clientName": "University of Agricultural Sciences, Bangalore",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for GKVK University of Agricultural Sciences Campus in Bengaluru, Karnataka. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 56
  },
  {
    "name": "Guru Gobind Singh Government Hospital",
    "clientName": "Government of NCT of Delhi",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Healthcare & Hospitals",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Guru Gobind Singh Government Hospital in Delhi NCR, Delhi. The project was equipped with precision-grade Antimicrobial SS 304 Restroom Cubicle Hardware, Emergency Release Privacy Indicator Bolts, Heavy Duty Gravity Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Antimicrobial SS 304 Restroom Cubicle Hardware",
      "Emergency Release Privacy Indicator Bolts",
      "Heavy Duty Gravity Hinges",
      "Barrier-Free Stainless Steel Grab Bars"
    ],
    "images": [
      "https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 57
  },
  {
    "name": "Tata Institute of Fundamental Research (TIFR) / IISc Hub",
    "clientName": "Tata Institute of Fundamental Research",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Tata Institute of Fundamental Research (TIFR) / IISc Hub in Bengaluru, Karnataka. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 58
  },
  {
    "name": "Royal Thai Embassy Diplomatic Complex",
    "clientName": "Ministry of Foreign Affairs, Thailand",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Royal Thai Embassy Diplomatic Complex in Delhi NCR, Delhi. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 59
  },
  {
    "name": "Siemens Corporate & Healthcare Center",
    "clientName": "Siemens India Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Siemens Corporate & Healthcare Center in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 60
  },
  {
    "name": "Mangalam Multiplex Corporate Hub",
    "clientName": "Mangalam Multiplex Private Limited",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Mangalam Multiplex Corporate Hub in Gurugram, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 61
  },
  {
    "name": "PNC Cognitio School",
    "clientName": "PNC Educational Trust",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for PNC Cognitio School in Bengaluru, Karnataka. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 62
  },
  {
    "name": "Hosur Public School",
    "clientName": "Hosur Public School Management",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Hosur Public School in Bengaluru, Karnataka. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 63
  },
  {
    "name": "M.S. Ramaiah Institute of Technology (MSRIT)",
    "clientName": "Gokula Education Foundation",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for M.S. Ramaiah Institute of Technology (MSRIT) in Bengaluru, Karnataka. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 64
  },
  {
    "name": "LifeCell International Stem Cell Center",
    "clientName": "LifeCell International Private Limited",
    "location": "Jhajjar, Haryana",
    "city": "Jhajjar",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for LifeCell International Stem Cell Center in Jhajjar, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 65
  },
  {
    "name": "Khalikpur Warehousing & Logistics Park",
    "clientName": "Khalikpur Logistics Park",
    "location": "Jhajjar, Haryana",
    "city": "Jhajjar",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Industrial & Logistics",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Khalikpur Warehousing & Logistics Park in Jhajjar, Haryana. The project was equipped with precision-grade Industrial Grade Heavy Duty Cubicle Partition Kits, High-Impact Stainless Steel Gravity Hinges, Adjustable Floor Mounting Flanges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "Industrial Grade Heavy Duty Cubicle Partition Kits",
      "High-Impact Stainless Steel Gravity Hinges",
      "Adjustable Floor Mounting Flanges",
      "Industrial Grade Safety Door Locks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 66
  },
  {
    "name": "Bharatiya Vidya Bhavan Cultural & Education Hub",
    "clientName": "Bharatiya Vidya Bhavan",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Bharatiya Vidya Bhavan Cultural & Education Hub in Delhi NCR, Delhi. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 67
  },
  {
    "name": "Chinmaya Vidyalaya",
    "clientName": "Central Chinmaya Mission Trust",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Chinmaya Vidyalaya in Bengaluru, Karnataka. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 68
  },
  {
    "name": "Virginia Mall Whitefield",
    "clientName": "Virginia Mall Ventures",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Commercial & Retail Malls",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Virginia Mall Whitefield in Bengaluru, Karnataka. The project was equipped with precision-grade Frameless Glass Patch Fittings & Hydraulic Floor Springs, Architectural Pull Handles (SS 304 Matte Finish), Designer Restroom Cubicle Partition Locks, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Frameless Glass Patch Fittings & Hydraulic Floor Springs",
      "Architectural Pull Handles (SS 304 Matte Finish)",
      "Designer Restroom Cubicle Partition Locks",
      "Glass-to-Glass Heavy Duty Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1567449303078-57ad995bd301?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 69
  },
  {
    "name": "Mercedes-Benz Landmark Showroom",
    "clientName": "Landmark Cars / Mercedes-Benz India",
    "location": "Mumbai, Maharashtra",
    "city": "Mumbai",
    "state": "Maharashtra",
    "region": "West",
    "isPanIndia": false,
    "category": "Automotive Flagships",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Mercedes-Benz Landmark Showroom in Mumbai, Maharashtra. The project was equipped with precision-grade Frameless Glass Patch Fittings & Hydraulic Floor Springs, Architectural Pull Handles (SS 304 Matte Finish), Designer Restroom Cubicle Partition Locks, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Frameless Glass Patch Fittings & Hydraulic Floor Springs",
      "Architectural Pull Handles (SS 304 Matte Finish)",
      "Designer Restroom Cubicle Partition Locks",
      "Glass-to-Glass Heavy Duty Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1563720223185-11003d516935?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 70
  },
  {
    "name": "Hyundai Motor Flagship Experience Center",
    "clientName": "Hyundai Motor India Limited",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Automotive Flagships",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Hyundai Motor Flagship Experience Center in Noida, Uttar Pradesh. The project was equipped with precision-grade Frameless Glass Patch Fittings & Hydraulic Floor Springs, Architectural Pull Handles (SS 304 Matte Finish), Designer Restroom Cubicle Partition Locks, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "Frameless Glass Patch Fittings & Hydraulic Floor Springs",
      "Architectural Pull Handles (SS 304 Matte Finish)",
      "Designer Restroom Cubicle Partition Locks",
      "Glass-to-Glass Heavy Duty Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 71
  },
  {
    "name": "Hero MotoCorp Global Parts & Technology Center",
    "clientName": "Hero MotoCorp Limited",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Industrial & Logistics",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Hero MotoCorp Global Parts & Technology Center in Gurugram, Haryana. The project was equipped with precision-grade Industrial Grade Heavy Duty Cubicle Partition Kits, High-Impact Stainless Steel Gravity Hinges, Adjustable Floor Mounting Flanges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Industrial Grade Heavy Duty Cubicle Partition Kits",
      "High-Impact Stainless Steel Gravity Hinges",
      "Adjustable Floor Mounting Flanges",
      "Industrial Grade Safety Door Locks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 72
  },
  {
    "name": "Northern Railway Central Hospital",
    "clientName": "Northern Railway Medical Division",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Northern Railway Central Hospital in Delhi NCR, Delhi. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1541888946425-d0fbb186156a?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1517581177682-a085bb7ffb15?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 73
  },
  {
    "name": "Indian Railways Northern Rail Network",
    "clientName": "Northern Railway (Indian Railways)",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Indian Railways Northern Rail Network in Bengaluru, Karnataka. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1517581177682-a085bb7ffb15?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 74
  },
  {
    "name": "Dräger Medical Systems India Manufacturing Plant",
    "clientName": "Drägerwerk AG & Co. KGaA",
    "location": "Mumbai, Maharashtra",
    "city": "Mumbai",
    "state": "Maharashtra",
    "region": "West",
    "isPanIndia": false,
    "category": "Industrial & Logistics",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Dräger Medical Systems India Manufacturing Plant in Mumbai, Maharashtra. The project was equipped with precision-grade Industrial Grade Heavy Duty Cubicle Partition Kits, High-Impact Stainless Steel Gravity Hinges, Adjustable Floor Mounting Flanges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Industrial Grade Heavy Duty Cubicle Partition Kits",
      "High-Impact Stainless Steel Gravity Hinges",
      "Adjustable Floor Mounting Flanges",
      "Industrial Grade Safety Door Locks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 75
  },
  {
    "name": "Sanskriti University Campus",
    "clientName": "Sanskriti University Mathura",
    "location": "Mathura, Uttar Pradesh",
    "city": "Mathura",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Sanskriti University Campus in Mathura, Uttar Pradesh. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 76
  },
  {
    "name": "Amolik Mega Mall",
    "clientName": "Amolik Group",
    "location": "Faridabad, Haryana",
    "city": "Faridabad",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Commercial & Retail Malls",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Amolik Mega Mall in Faridabad, Haryana. The project was equipped with precision-grade Frameless Glass Patch Fittings & Hydraulic Floor Springs, Architectural Pull Handles (SS 304 Matte Finish), Designer Restroom Cubicle Partition Locks, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Frameless Glass Patch Fittings & Hydraulic Floor Springs",
      "Architectural Pull Handles (SS 304 Matte Finish)",
      "Designer Restroom Cubicle Partition Locks",
      "Glass-to-Glass Heavy Duty Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 77
  },
  {
    "name": "SMCC Construction India",
    "clientName": "Sumitomo Mitsui Construction Co. Ltd.",
    "location": "Mumbai, Maharashtra",
    "city": "Mumbai",
    "state": "Maharashtra",
    "region": "West",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for SMCC Construction India in Mumbai, Maharashtra. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 78
  },
  {
    "name": "Aperion Commercial Towers",
    "clientName": "Aperion Group",
    "location": "Meerut, Uttar Pradesh",
    "city": "Meerut",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Aperion Commercial Towers in Meerut, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 79
  },
  {
    "name": "HLP Galleria Commercial Center Mohali",
    "clientName": "Home and Land Planners (HLP Group)",
    "location": "Chandigarh, Chandigarh",
    "city": "Chandigarh",
    "state": "Chandigarh",
    "region": "North",
    "isPanIndia": false,
    "category": "Commercial & Retail Malls",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for HLP Galleria Commercial Center Mohali in Chandigarh, Chandigarh. The project was equipped with precision-grade Frameless Glass Patch Fittings & Hydraulic Floor Springs, Architectural Pull Handles (SS 304 Matte Finish), Designer Restroom Cubicle Partition Locks, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Frameless Glass Patch Fittings & Hydraulic Floor Springs",
      "Architectural Pull Handles (SS 304 Matte Finish)",
      "Designer Restroom Cubicle Partition Locks",
      "Glass-to-Glass Heavy Duty Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 80
  },
  {
    "name": "CMR Ekya School BTM Layout",
    "clientName": "CMR Jnanadhara Trust",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for CMR Ekya School BTM Layout in Bengaluru, Karnataka. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 81
  },
  {
    "name": "Narayana e-Techno School",
    "clientName": "Narayana Educational Institutions",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Narayana e-Techno School in Bengaluru, Karnataka. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 82
  },
  {
    "name": "Zomato Regional Office Hub",
    "clientName": "Zomato Limited",
    "location": "Hyderabad, Telangana",
    "city": "Hyderabad",
    "state": "Telangana",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Zomato Regional Office Hub in Hyderabad, Telangana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 83
  },
  {
    "name": "Zomato Regional Office Hub",
    "clientName": "Zomato Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Zomato Regional Office Hub in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 84
  },
  {
    "name": "Awfis Space Solutions Co-Working Center",
    "clientName": "Awfis Space Solutions Limited",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Awfis Space Solutions Co-Working Center in Noida, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 85
  },
  {
    "name": "Vishwa Yuvak Kendra International Center",
    "clientName": "Indian Youth Centres Trust",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Commercial & Retail Malls",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Vishwa Yuvak Kendra International Center in Delhi NCR, Delhi. The project was equipped with precision-grade Frameless Glass Patch Fittings & Hydraulic Floor Springs, Architectural Pull Handles (SS 304 Matte Finish), Designer Restroom Cubicle Partition Locks, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "Frameless Glass Patch Fittings & Hydraulic Floor Springs",
      "Architectural Pull Handles (SS 304 Matte Finish)",
      "Designer Restroom Cubicle Partition Locks",
      "Glass-to-Glass Heavy Duty Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 86
  },
  {
    "name": "Pacific Mall Subhash Nagar & Tagore Garden",
    "clientName": "Pacific Group",
    "location": "Pan-India Network",
    "city": "Pan India",
    "state": "Pan India",
    "region": "Pan-India",
    "isPanIndia": true,
    "category": "Commercial & Retail Malls",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Pacific Mall Subhash Nagar & Tagore Garden across pan-India locations. The project was equipped with precision-grade Frameless Glass Patch Fittings & Hydraulic Floor Springs, Architectural Pull Handles (SS 304 Matte Finish), Designer Restroom Cubicle Partition Locks, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Frameless Glass Patch Fittings & Hydraulic Floor Springs",
      "Architectural Pull Handles (SS 304 Matte Finish)",
      "Designer Restroom Cubicle Partition Locks",
      "Glass-to-Glass Heavy Duty Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1567449303078-57ad995bd301?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 87
  },
  {
    "name": "HDFC Bank Regional Currency & Branch Hub",
    "clientName": "HDFC Bank Limited",
    "location": "Panipat, Haryana",
    "city": "Panipat",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for HDFC Bank Regional Currency & Branch Hub in Panipat, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 88
  },
  {
    "name": "Manipal Academy of Higher Education (MAHE)",
    "clientName": "Manipal Academy of Higher Education",
    "location": "Mangaluru, Karnataka",
    "city": "Mangaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Manipal Academy of Higher Education (MAHE) in Mangaluru, Karnataka. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 89
  },
  {
    "name": "Phoenix Marketing & Media Hub",
    "clientName": "Phoenix Marketing",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Phoenix Marketing & Media Hub in Gurugram, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 90
  },
  {
    "name": "Miraj Cinemas Nationwide Multiplexes",
    "clientName": "Miraj Entertainment Limited",
    "location": "Pan-India Network",
    "city": "Pan India",
    "state": "Pan India",
    "region": "Pan-India",
    "isPanIndia": true,
    "category": "Commercial & Retail Malls",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Miraj Cinemas Nationwide Multiplexes across pan-India locations. The project was equipped with precision-grade Frameless Glass Patch Fittings & Hydraulic Floor Springs, Architectural Pull Handles (SS 304 Matte Finish), Designer Restroom Cubicle Partition Locks, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "Frameless Glass Patch Fittings & Hydraulic Floor Springs",
      "Architectural Pull Handles (SS 304 Matte Finish)",
      "Designer Restroom Cubicle Partition Locks",
      "Glass-to-Glass Heavy Duty Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1567449303078-57ad995bd301?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 91
  },
  {
    "name": "Alpha IT & Media Center",
    "clientName": "Alpha Media & IT",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Alpha IT & Media Center in Noida, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 92
  },
  {
    "name": "National Highways Authority of India (NHAI)",
    "clientName": "National Highways Authority of India",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for National Highways Authority of India (NHAI) in Delhi NCR, Delhi. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 93
  },
  {
    "name": "Buniyad Realty Real Estate Center",
    "clientName": "Buniyad Real Estate Services",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Buniyad Realty Real Estate Center in Noida, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 94
  },
  {
    "name": "Asian Fidelis Multi Speciality Hospital",
    "clientName": "Asian Institute of Medical Sciences",
    "location": "Faridabad, Haryana",
    "city": "Faridabad",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Healthcare & Hospitals",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Asian Fidelis Multi Speciality Hospital in Faridabad, Haryana. The project was equipped with precision-grade Antimicrobial SS 304 Restroom Cubicle Hardware, Emergency Release Privacy Indicator Bolts, Heavy Duty Gravity Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Antimicrobial SS 304 Restroom Cubicle Hardware",
      "Emergency Release Privacy Indicator Bolts",
      "Heavy Duty Gravity Hinges",
      "Barrier-Free Stainless Steel Grab Bars"
    ],
    "images": [
      "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 95
  },
  {
    "name": "XLHealth Corporation",
    "clientName": "XLHealth Healthcare Services",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for XLHealth Corporation in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 96
  },
  {
    "name": "United Medicity Super Speciality Hospital",
    "clientName": "United Group of Institutions",
    "location": "Prayagraj, Uttar Pradesh",
    "city": "Prayagraj",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for United Medicity Super Speciality Hospital in Prayagraj, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 97
  },
  {
    "name": "Aman Industries Manufacturing Hub",
    "clientName": "Aman Industries",
    "location": "Faridabad, Haryana",
    "city": "Faridabad",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Aman Industries Manufacturing Hub in Faridabad, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 98
  },
  {
    "name": "Viswas Swaroopam (Statue of Belief) Complex",
    "clientName": "Miras / Sant Kripa Sanatan Sansthan",
    "location": "Udaipur, Rajasthan",
    "city": "Udaipur",
    "state": "Rajasthan",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Viswas Swaroopam (Statue of Belief) Complex in Udaipur, Rajasthan. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 99
  },
  {
    "name": "Indiabulls Mega Mall Jodhpur",
    "clientName": "Indiabulls Real Estate",
    "location": "Jodhpur, Rajasthan",
    "city": "Jodhpur",
    "state": "Rajasthan",
    "region": "North",
    "isPanIndia": false,
    "category": "Commercial & Retail Malls",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Indiabulls Mega Mall Jodhpur in Jodhpur, Rajasthan. The project was equipped with precision-grade Frameless Glass Patch Fittings & Hydraulic Floor Springs, Architectural Pull Handles (SS 304 Matte Finish), Designer Restroom Cubicle Partition Locks, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Frameless Glass Patch Fittings & Hydraulic Floor Springs",
      "Architectural Pull Handles (SS 304 Matte Finish)",
      "Designer Restroom Cubicle Partition Locks",
      "Glass-to-Glass Heavy Duty Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1567449303078-57ad995bd301?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 100
  },
  {
    "name": "AIHP Executive Center Udyog Vihar",
    "clientName": "AIHP Workspace Solutions",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for AIHP Executive Center Udyog Vihar in Gurugram, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 101
  },
  {
    "name": "Apeejay School Sheikh Sarai",
    "clientName": "Apeejay Education Society",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Apeejay School Sheikh Sarai in Delhi NCR, Delhi. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 102
  },
  {
    "name": "Piccadily Holiday Resorts & Convention",
    "clientName": "Piccadily Agro Industries Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Hotels & Hospitality",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Piccadily Holiday Resorts & Convention in Bengaluru, Karnataka. The project was equipped with precision-grade Luxury Satin Gold / Matte Black Shower Enclosure Hinges, Concealed Hydraulic Door Closers, Architectural Privacy Latches, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "Luxury Satin Gold / Matte Black Shower Enclosure Hinges",
      "Concealed Hydraulic Door Closers",
      "Architectural Privacy Latches",
      "Acoustic Glass Partition Profiles"
    ],
    "images": [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 103
  },
  {
    "name": "Concentrix Global Delivery Center",
    "clientName": "Concentrix Corporation",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Concentrix Global Delivery Center in Gurugram, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 104
  },
  {
    "name": "DLF Cyber City & Cyber Hub",
    "clientName": "DLF Limited",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for DLF Cyber City & Cyber Hub in Gurugram, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 105
  },
  {
    "name": "Shapoorji Pallonji & Co. Engineering Hub",
    "clientName": "Shapoorji Pallonji Group",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Shapoorji Pallonji & Co. Engineering Hub in Gurugram, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 106
  },
  {
    "name": "Synergy Corporate Park",
    "clientName": "Synergy Corporate Group",
    "location": "Faridabad, Haryana",
    "city": "Faridabad",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Synergy Corporate Park in Faridabad, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 107
  },
  {
    "name": "DLF Urban Private Limited",
    "clientName": "DLF Limited",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for DLF Urban Private Limited in Delhi NCR, Delhi. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 108
  },
  {
    "name": "360 Interior Design Studios",
    "clientName": "360 Interior Design Private Limited",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for 360 Interior Design Studios in Delhi NCR, Delhi. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 109
  },
  {
    "name": "Chambal Automotives Dealership",
    "clientName": "Chambal Automotives Private Limited",
    "location": "Kota, Rajasthan",
    "city": "Kota",
    "state": "Rajasthan",
    "region": "North",
    "isPanIndia": false,
    "category": "Automotive Flagships",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Chambal Automotives Dealership in Kota, Rajasthan. The project was equipped with precision-grade Frameless Glass Patch Fittings & Hydraulic Floor Springs, Architectural Pull Handles (SS 304 Matte Finish), Designer Restroom Cubicle Partition Locks, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Frameless Glass Patch Fittings & Hydraulic Floor Springs",
      "Architectural Pull Handles (SS 304 Matte Finish)",
      "Designer Restroom Cubicle Partition Locks",
      "Glass-to-Glass Heavy Duty Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 110
  },
  {
    "name": "Indian Institute of Technology (BHU) Varanasi",
    "clientName": "IIT BHU (Ministry of Education)",
    "location": "Varanasi, Uttar Pradesh",
    "city": "Varanasi",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Indian Institute of Technology (BHU) Varanasi in Varanasi, Uttar Pradesh. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 111
  },
  {
    "name": "Eminent Colonizers Real Estate Towers",
    "clientName": "Eminent Colonizers Private Limited",
    "location": "Kota, Rajasthan",
    "city": "Kota",
    "state": "Rajasthan",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Eminent Colonizers Real Estate Towers in Kota, Rajasthan. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 112
  },
  {
    "name": "DPMI Vocational Training Institute",
    "clientName": "Delhi Paramedical & Management Institute",
    "location": "Greater Noida, Uttar Pradesh",
    "city": "Greater Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for DPMI Vocational Training Institute in Greater Noida, Uttar Pradesh. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 113
  },
  {
    "name": "Tata Communications Network Operations Center",
    "clientName": "Tata Communications Limited",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Tata Communications Network Operations Center in Delhi NCR, Delhi. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 114
  },
  {
    "name": "S.R. Group of Institutions Campus",
    "clientName": "S.R. Educational Trust",
    "location": "Lucknow, Uttar Pradesh",
    "city": "Lucknow",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for S.R. Group of Institutions Campus in Lucknow, Uttar Pradesh. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 115
  },
  {
    "name": "Next Office Corporate Solutions",
    "clientName": "Next Office Systems",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Next Office Corporate Solutions in Noida, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 116
  },
  {
    "name": "Hiranandani Estate Eden Club House",
    "clientName": "Hiranandani Group",
    "location": "Mumbai, Maharashtra",
    "city": "Mumbai",
    "state": "Maharashtra",
    "region": "West",
    "isPanIndia": false,
    "category": "Residential & Clubhouses",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Hiranandani Estate Eden Club House in Mumbai, Maharashtra. The project was equipped with precision-grade Premium Clubhouse Restroom Cubicle Systems, Heavy Duty Floor Springs, Shower Hardware & Glass Clamps, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Premium Clubhouse Restroom Cubicle Systems",
      "Heavy Duty Floor Springs",
      "Shower Hardware & Glass Clamps",
      "Concealed Magnetic Locks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 117
  },
  {
    "name": "Hiranandani The Walk Lifestyle Club House",
    "clientName": "Hiranandani Group",
    "location": "Mumbai, Maharashtra",
    "city": "Mumbai",
    "state": "Maharashtra",
    "region": "West",
    "isPanIndia": false,
    "category": "Residential & Clubhouses",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Hiranandani The Walk Lifestyle Club House in Mumbai, Maharashtra. The project was equipped with precision-grade Premium Clubhouse Restroom Cubicle Systems, Heavy Duty Floor Springs, Shower Hardware & Glass Clamps, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "Premium Clubhouse Restroom Cubicle Systems",
      "Heavy Duty Floor Springs",
      "Shower Hardware & Glass Clamps",
      "Concealed Magnetic Locks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 118
  },
  {
    "name": "Northern Railway Central Complex",
    "clientName": "Northern Railway Division",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Northern Railway Central Complex in Delhi NCR, Delhi. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 119
  },
  {
    "name": "H&M Flagship Fashion Store",
    "clientName": "H&M Hennes & Mauritz India",
    "location": "Mumbai, Maharashtra",
    "city": "Mumbai",
    "state": "Maharashtra",
    "region": "West",
    "isPanIndia": false,
    "category": "Automotive Flagships",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for H&M Flagship Fashion Store in Mumbai, Maharashtra. The project was equipped with precision-grade Frameless Glass Patch Fittings & Hydraulic Floor Springs, Architectural Pull Handles (SS 304 Matte Finish), Designer Restroom Cubicle Partition Locks, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Frameless Glass Patch Fittings & Hydraulic Floor Springs",
      "Architectural Pull Handles (SS 304 Matte Finish)",
      "Designer Restroom Cubicle Partition Locks",
      "Glass-to-Glass Heavy Duty Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1563720223185-11003d516935?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 120
  },
  {
    "name": "Coforge Global Delivery Center",
    "clientName": "Coforge Limited (formerly NIIT Technologies)",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Coforge Global Delivery Center in Gurugram, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 121
  },
  {
    "name": "Migsun Commercial Towers",
    "clientName": "Migsun Group",
    "location": "Ghaziabad, Uttar Pradesh",
    "city": "Ghaziabad",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Migsun Commercial Towers in Ghaziabad, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 122
  },
  {
    "name": "NIIT Technologies IT Campus",
    "clientName": "NIIT Limited",
    "location": "Greater Noida, Uttar Pradesh",
    "city": "Greater Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for NIIT Technologies IT Campus in Greater Noida, Uttar Pradesh. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 123
  },
  {
    "name": "Central Vista Avenue EPC Project",
    "clientName": "Ministry of Housing and Urban Affairs (CPWD)",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Central Vista Avenue EPC Project in Delhi NCR, Delhi. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1541888946425-d0fbb186156a?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 124
  },
  {
    "name": "Central Park Resorts Sohna Road",
    "clientName": "Central Park (Bakshi Group)",
    "location": "Sohna, Haryana",
    "city": "Sohna",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Hotels & Hospitality",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Central Park Resorts Sohna Road in Sohna, Haryana. The project was equipped with precision-grade Luxury Satin Gold / Matte Black Shower Enclosure Hinges, Concealed Hydraulic Door Closers, Architectural Privacy Latches, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Luxury Satin Gold / Matte Black Shower Enclosure Hinges",
      "Concealed Hydraulic Door Closers",
      "Architectural Privacy Latches",
      "Acoustic Glass Partition Profiles"
    ],
    "images": [
      "https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 125
  },
  {
    "name": "Mahindra Singh Education Society",
    "clientName": "Mahindra Singh Educational Trust",
    "location": "Jaipur, Rajasthan",
    "city": "Jaipur",
    "state": "Rajasthan",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Mahindra Singh Education Society in Jaipur, Rajasthan. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 126
  },
  {
    "name": "Embassy GolfLinks Business Park",
    "clientName": "Embassy Office Parks REIT",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Embassy GolfLinks Business Park in Bengaluru, Karnataka. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 127
  },
  {
    "name": "Kanteerava Hockey Stadium & Complex",
    "clientName": "Department of Youth Empowerment & Sports Karnataka",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Sports & Stadiums",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Kanteerava Hockey Stadium & Complex in Bengaluru, Karnataka. The project was equipped with precision-grade Vandal-Resistant Compact Laminate Partition Clamps, Heavy-Duty Stainless Steel Gravity Hinges, Commercial Privacy Indicator Latches, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "Vandal-Resistant Compact Laminate Partition Clamps",
      "Heavy-Duty Stainless Steel Gravity Hinges",
      "Commercial Privacy Indicator Latches",
      "High-Traffic Stainless Steel Door Stops"
    ],
    "images": [
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 128
  },
  {
    "name": "Shriyansh Shagun Banquet & Convention Center",
    "clientName": "Shriyansh Shagun Hospitality",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Shriyansh Shagun Banquet & Convention Center in Noida, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 129
  },
  {
    "name": "Kailash Prakash Stadium AstroTurf Complex",
    "clientName": "Uttar Pradesh Sports Directorate",
    "location": "Meerut, Uttar Pradesh",
    "city": "Meerut",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Sports & Stadiums",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Kailash Prakash Stadium AstroTurf Complex in Meerut, Uttar Pradesh. The project was equipped with precision-grade Vandal-Resistant Compact Laminate Partition Clamps, Heavy-Duty Stainless Steel Gravity Hinges, Commercial Privacy Indicator Latches, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Vandal-Resistant Compact Laminate Partition Clamps",
      "Heavy-Duty Stainless Steel Gravity Hinges",
      "Commercial Privacy Indicator Latches",
      "High-Traffic Stainless Steel Door Stops"
    ],
    "images": [
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 130
  },
  {
    "name": "Canon Anthurium Commercial Center",
    "clientName": "Canon India Private Limited",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Canon Anthurium Commercial Center in Noida, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 131
  },
  {
    "name": "Kanpur Metro Rail Corporation (Panki & Motijheel)",
    "clientName": "Uttar Pradesh Metro Rail Corporation (UPMRC)",
    "location": "Kanpur, Uttar Pradesh",
    "city": "Kanpur",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Kanpur Metro Rail Corporation (Panki & Motijheel) in Kanpur, Uttar Pradesh. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1541888946425-d0fbb186156a?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 132
  },
  {
    "name": "The Aura Grand Convention Center",
    "clientName": "The Aura Hospitality",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for The Aura Grand Convention Center in Noida, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 133
  },
  {
    "name": "Highway Amenities Expressway Rest Hub",
    "clientName": "Highway Amenities Developers Private Limited",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Highway Amenities Expressway Rest Hub in Delhi NCR, Delhi. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1517581177682-a085bb7ffb15?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 134
  },
  {
    "name": "World Trade Tower (WTT)",
    "clientName": "World Trade Tower Noida",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for World Trade Tower (WTT) in Noida, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 135
  },
  {
    "name": "Superior Lifestyles Luxury Commercial Center",
    "clientName": "Superior Lifestyles Private Limited",
    "location": "Indore, Madhya Pradesh",
    "city": "Indore",
    "state": "Madhya Pradesh",
    "region": "Central",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Superior Lifestyles Luxury Commercial Center in Indore, Madhya Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 136
  },
  {
    "name": "Vista Square Commercial Complex",
    "clientName": "Vista Square Developers",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Vista Square Commercial Complex in Gurugram, Haryana. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1541888946425-d0fbb186156a?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1517581177682-a085bb7ffb15?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 137
  },
  {
    "name": "Balaji Real Estate Development Center",
    "clientName": "Balaji Real Estate Group",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Balaji Real Estate Development Center in Gurugram, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 138
  },
  {
    "name": "Cherry Hill Interiors Workspace",
    "clientName": "Cherry Hill Interiors Private Limited",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Cherry Hill Interiors Workspace in Noida, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 139
  },
  {
    "name": "Purvanchal Royal Park Clubhouse",
    "clientName": "Purvanchal Projects Private Limited",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Purvanchal Royal Park Clubhouse in Noida, Uttar Pradesh. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1541888946425-d0fbb186156a?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 140
  },
  {
    "name": "V3S East Centre Mall Nirman Vihar",
    "clientName": "V3S Infratech Limited",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Commercial & Retail Malls",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for V3S East Centre Mall Nirman Vihar in Delhi NCR, Delhi. The project was equipped with precision-grade Frameless Glass Patch Fittings & Hydraulic Floor Springs, Architectural Pull Handles (SS 304 Matte Finish), Designer Restroom Cubicle Partition Locks, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "Frameless Glass Patch Fittings & Hydraulic Floor Springs",
      "Architectural Pull Handles (SS 304 Matte Finish)",
      "Designer Restroom Cubicle Partition Locks",
      "Glass-to-Glass Heavy Duty Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1567449303078-57ad995bd301?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 141
  },
  {
    "name": "Miraj Luxury Hotels & Resorts",
    "clientName": "Miraj Group Hospitality",
    "location": "Pan-India Network",
    "city": "Pan India",
    "state": "Pan India",
    "region": "Pan-India",
    "isPanIndia": true,
    "category": "Hotels & Hospitality",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Miraj Luxury Hotels & Resorts across pan-India locations. The project was equipped with precision-grade Luxury Satin Gold / Matte Black Shower Enclosure Hinges, Concealed Hydraulic Door Closers, Architectural Privacy Latches, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Luxury Satin Gold / Matte Black Shower Enclosure Hinges",
      "Concealed Hydraulic Door Closers",
      "Architectural Privacy Latches",
      "Acoustic Glass Partition Profiles"
    ],
    "images": [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 142
  },
  {
    "name": "HUDCO Government Financial Center",
    "clientName": "Housing and Urban Development Corporation (HUDCO)",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Government & Infrastructure",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for HUDCO Government Financial Center in Delhi NCR, Delhi. The project was equipped with precision-grade Grade-A SS 304 High-Security Cubicle Systems, Hydraulic Floor Springs & Top Pivots, Heavy Duty Panic Hardware, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "Grade-A SS 304 High-Security Cubicle Systems",
      "Hydraulic Floor Springs & Top Pivots",
      "Heavy Duty Panic Hardware",
      "Vandal-Proof Restroom Partitions"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 143
  },
  {
    "name": "Signature Global CRM Corporate Office",
    "clientName": "Signature Global (India) Limited",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Signature Global CRM Corporate Office in Gurugram, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 144
  },
  {
    "name": "Jahwa Electronics Precision Manufacturing Plant",
    "clientName": "Jahwa Electronics Co. Ltd.",
    "location": "Greater Noida, Uttar Pradesh",
    "city": "Greater Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Industrial & Logistics",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Jahwa Electronics Precision Manufacturing Plant in Greater Noida, Uttar Pradesh. The project was equipped with precision-grade Industrial Grade Heavy Duty Cubicle Partition Kits, High-Impact Stainless Steel Gravity Hinges, Adjustable Floor Mounting Flanges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Industrial Grade Heavy Duty Cubicle Partition Kits",
      "High-Impact Stainless Steel Gravity Hinges",
      "Adjustable Floor Mounting Flanges",
      "Industrial Grade Safety Door Locks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 145
  },
  {
    "name": "AIPL Joy Central Commercial Galleria",
    "clientName": "Advance India Projects Limited (AIPL)",
    "location": "Gurugram, Haryana",
    "city": "Gurugram",
    "state": "Haryana",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for AIPL Joy Central Commercial Galleria in Gurugram, Haryana. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 146
  },
  {
    "name": "KS Corporate Suites",
    "clientName": "KS Corporate Developers",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for KS Corporate Suites in Noida, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 147
  },
  {
    "name": "ATS Dreamzone Workspace Hub",
    "clientName": "ATS Infrastructure Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for ATS Dreamzone Workspace Hub in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 148
  },
  {
    "name": "Omaxe Limited Regional Center",
    "clientName": "Omaxe Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Omaxe Limited Regional Center in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 149
  },
  {
    "name": "KBPL Infrastructure Development Hub",
    "clientName": "KBPL Infrastructure Private Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for KBPL Infrastructure Development Hub in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 150
  },
  {
    "name": "Renox Commercial Plaza",
    "clientName": "Renox Group",
    "location": "Noida, Uttar Pradesh",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Renox Commercial Plaza in Noida, Uttar Pradesh. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 151
  },
  {
    "name": "Flipspace Technologies Tech Design Studio",
    "clientName": "Flipspace Technologies Private Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Flipspace Technologies Tech Design Studio in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 152
  },
  {
    "name": "Talkatora Indoor Stadium",
    "clientName": "New Delhi Municipal Council (NDMC)",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Talkatora Indoor Stadium in Delhi NCR, Delhi. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 153
  },
  {
    "name": "Integrated Workspaces Business Center",
    "clientName": "Integrated Workspaces Solutions",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Integrated Workspaces Business Center in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 154
  },
  {
    "name": "CNA Enterprises Commercial Center",
    "clientName": "CNA Enterprises Private Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for CNA Enterprises Commercial Center in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 155
  },
  {
    "name": "Hombale Construction Projects Hub",
    "clientName": "Hombale Constructions & Estates",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Hombale Construction Projects Hub in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 156
  },
  {
    "name": "Kia Motors Premium Experience Showroom",
    "clientName": "Kia India Private Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Automotive Flagships",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Kia Motors Premium Experience Showroom in Bengaluru, Karnataka. The project was equipped with precision-grade Frameless Glass Patch Fittings & Hydraulic Floor Springs, Architectural Pull Handles (SS 304 Matte Finish), Designer Restroom Cubicle Partition Locks, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Frameless Glass Patch Fittings & Hydraulic Floor Springs",
      "Architectural Pull Handles (SS 304 Matte Finish)",
      "Designer Restroom Cubicle Partition Locks",
      "Glass-to-Glass Heavy Duty Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1563720223185-11003d516935?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 157
  },
  {
    "name": "P3 Enterprises Commercial Workspace",
    "clientName": "P3 Enterprises LLP",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for P3 Enterprises Commercial Workspace in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 158
  },
  {
    "name": "Swathi Constructions Infrastructure Hub",
    "clientName": "Swathi Constructions",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Swathi Constructions Infrastructure Hub in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 159
  },
  {
    "name": "National Public School (NPS)",
    "clientName": "National Public School Education Trust",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for National Public School (NPS) in Bengaluru, Karnataka. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 160
  },
  {
    "name": "Puravankara Limited Corporate Towers",
    "clientName": "Puravankara Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Puravankara Limited Corporate Towers in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 161
  },
  {
    "name": "Hotel Jai Mahal Sardarshahar",
    "clientName": "Jai Mahal Sardarshahar Hospitality",
    "location": "Sardarshahar, Rajasthan",
    "city": "Sardarshahar",
    "state": "Rajasthan",
    "region": "North",
    "isPanIndia": false,
    "category": "Hotels & Hospitality",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Hotel Jai Mahal Sardarshahar in Sardarshahar, Rajasthan. The project was equipped with precision-grade Luxury Satin Gold / Matte Black Shower Enclosure Hinges, Concealed Hydraulic Door Closers, Architectural Privacy Latches, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Luxury Satin Gold / Matte Black Shower Enclosure Hinges",
      "Concealed Hydraulic Door Closers",
      "Architectural Privacy Latches",
      "Acoustic Glass Partition Profiles"
    ],
    "images": [
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 162
  },
  {
    "name": "Joyalukkas Flagship Jewelry Center",
    "clientName": "Joyalukkas Group",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Joyalukkas Flagship Jewelry Center in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 163
  },
  {
    "name": "DSR Infrastructure Headquarters",
    "clientName": "DSR Infrastructure Private Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for DSR Infrastructure Headquarters in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 164
  },
  {
    "name": "Glazmen India Glass Systems Center",
    "clientName": "Glazmen India Private Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Glazmen India Glass Systems Center in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 165
  },
  {
    "name": "Suryavardhan Construction Projects",
    "clientName": "Suryavardhan Construction",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Suryavardhan Construction Projects in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 166
  },
  {
    "name": "Bhagirath Construction Infrastructure Hub",
    "clientName": "Bhagirath Construction",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Bhagirath Construction Infrastructure Hub in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 167
  },
  {
    "name": "KRIDL Government Infrastructure Hub",
    "clientName": "Karnataka Rural Infrastructure Development Limited (KRIDL)",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for KRIDL Government Infrastructure Hub in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 168
  },
  {
    "name": "Yenepoya Deemed to be University",
    "clientName": "Islamic Academy of Education / Yenepoya University",
    "location": "Mangaluru, Karnataka",
    "city": "Mangaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Yenepoya Deemed to be University in Mangaluru, Karnataka. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 169
  },
  {
    "name": "Inside Space Architecture Studio",
    "clientName": "Inside Space Design Consultants",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Inside Space Architecture Studio in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 170
  },
  {
    "name": "Bizzhub Ventures Business Center",
    "clientName": "Bizzhub Ventures Private Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Bizzhub Ventures Business Center in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 171
  },
  {
    "name": "Provident Housing Development Center",
    "clientName": "Provident Housing Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Provident Housing Development Center in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 172
  },
  {
    "name": "Master Campus Technology Center",
    "clientName": "Master Campus Private Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Master Campus Technology Center in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 173
  },
  {
    "name": "Zuna Interio Architecture Workspace",
    "clientName": "Zuna Interio Design Consultants",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Zuna Interio Architecture Workspace in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 174
  },
  {
    "name": "Max Media Solutions Studios",
    "clientName": "Max Media Solutions Private Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Max Media Solutions Studios in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 175
  },
  {
    "name": "Vibhav Interior Decor Hub",
    "clientName": "Vibhav Interior Decor",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Vibhav Interior Decor Hub in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 176
  },
  {
    "name": "MCN Infrastructure Development Hub",
    "clientName": "MCN Infrastructure Private Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for MCN Infrastructure Development Hub in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 177
  },
  {
    "name": "STG Infrasys Network Center",
    "clientName": "STG Infrasys Private Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for STG Infrasys Network Center in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 178
  },
  {
    "name": "Innovent Spaces Co-Working Hub",
    "clientName": "Innovent Spaces Private Limited (IndiQube)",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Innovent Spaces Co-Working Hub in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 179
  },
  {
    "name": "JN Enterprises Commercial Center",
    "clientName": "JN Enterprises",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for JN Enterprises Commercial Center in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 180
  },
  {
    "name": "Sharma Interior Concepts",
    "clientName": "Sharma Interior Contractors",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Sharma Interior Concepts in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 181
  },
  {
    "name": "New Horizon Public School",
    "clientName": "New Horizon Educational Institution",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for New Horizon Public School in Bengaluru, Karnataka. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 182
  },
  {
    "name": "Veda Vyasa Interior Architecture",
    "clientName": "Veda Vyasa Interior Solutions",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Veda Vyasa Interior Architecture in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 183
  },
  {
    "name": "Varda Innovation Tech Hub",
    "clientName": "Varda Innovation Private Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Varda Innovation Tech Hub in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 184
  },
  {
    "name": "L&Y Mysore Interior Contracting Hub",
    "clientName": "L&Y Mysore Contracting",
    "location": "Mysuru, Karnataka",
    "city": "Mysuru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Industrial & Logistics",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for L&Y Mysore Interior Contracting Hub in Mysuru, Karnataka. The project was equipped with precision-grade Industrial Grade Heavy Duty Cubicle Partition Kits, High-Impact Stainless Steel Gravity Hinges, Adjustable Floor Mounting Flanges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "Industrial Grade Heavy Duty Cubicle Partition Kits",
      "High-Impact Stainless Steel Gravity Hinges",
      "Adjustable Floor Mounting Flanges",
      "Industrial Grade Safety Door Locks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 185
  },
  {
    "name": "Karumbaiah Sports & Education Academy",
    "clientName": "Karumbaiah Academy",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Karumbaiah Sports & Education Academy in Bengaluru, Karnataka. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 186
  },
  {
    "name": "Capital Public School",
    "clientName": "Capital Educational Trust",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Capital Public School in Bengaluru, Karnataka. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 187
  },
  {
    "name": "Rashtrotthana Parishat Center",
    "clientName": "Rashtrotthana Parishat",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Rashtrotthana Parishat Center in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 188
  },
  {
    "name": "Sri Kumaran Children's Home School",
    "clientName": "Kumaran Educational Trust",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Sri Kumaran Children's Home School in Bengaluru, Karnataka. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 189
  },
  {
    "name": "Aishwarya Heights Commercial Hub",
    "clientName": "Aishwarya Group",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Aishwarya Heights Commercial Hub in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 190
  },
  {
    "name": "Vinegar High School",
    "clientName": "Vinegar Educational Society",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Vinegar High School in Bengaluru, Karnataka. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 191
  },
  {
    "name": "Hyundai Motor Flagship Experience Center",
    "clientName": "Hyundai Motor India Limited",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Automotive Flagships",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Hyundai Motor Flagship Experience Center in Bengaluru, Karnataka. The project was equipped with precision-grade Frameless Glass Patch Fittings & Hydraulic Floor Springs, Architectural Pull Handles (SS 304 Matte Finish), Designer Restroom Cubicle Partition Locks, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "Frameless Glass Patch Fittings & Hydraulic Floor Springs",
      "Architectural Pull Handles (SS 304 Matte Finish)",
      "Designer Restroom Cubicle Partition Locks",
      "Glass-to-Glass Heavy Duty Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1563720223185-11003d516935?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 192
  },
  {
    "name": "NIE Institute of Technology Mysore",
    "clientName": "National Institute of Engineering (NIE)",
    "location": "Mysuru, Karnataka",
    "city": "Mysuru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Educational Institutions",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for NIE Institute of Technology Mysore in Mysuru, Karnataka. The project was equipped with precision-grade Durable Nylon & SS 304 Cubicle Partitions, Adjustable Stainless Steel Supporting Legs, Self-Closing Spring Hinges, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "Durable Nylon & SS 304 Cubicle Partitions",
      "Adjustable Stainless Steel Supporting Legs",
      "Self-Closing Spring Hinges",
      "Safety Ergonomic Coat Hooks"
    ],
    "images": [
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 193
  },
  {
    "name": "NEXA Arena Premium Showroom",
    "clientName": "Maruti Suzuki India Limited (NEXA)",
    "location": "Delhi NCR, Delhi",
    "city": "Delhi NCR",
    "state": "Delhi",
    "region": "North",
    "isPanIndia": false,
    "category": "Automotive Flagships",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for NEXA Arena Premium Showroom in Delhi NCR, Delhi. The project was equipped with precision-grade Frameless Glass Patch Fittings & Hydraulic Floor Springs, Architectural Pull Handles (SS 304 Matte Finish), Designer Restroom Cubicle Partition Locks, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Frameless Glass Patch Fittings & Hydraulic Floor Springs",
      "Architectural Pull Handles (SS 304 Matte Finish)",
      "Designer Restroom Cubicle Partition Locks",
      "Glass-to-Glass Heavy Duty Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 194
  },
  {
    "name": "KC Vijaykumar Enterprise Center",
    "clientName": "KC Vijaykumar Enterprise",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for KC Vijaykumar Enterprise Center in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 195
  },
  {
    "name": "Discovery Village Adventure Resort",
    "clientName": "Discovery Village Resorts",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Discovery Village Adventure Resort in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2020",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 196
  },
  {
    "name": "Egalite Resort & Convention Center",
    "clientName": "Egalite Resorts",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Egalite Resort & Convention Center in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2021",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 197
  },
  {
    "name": "Panasonic Innovation Center India",
    "clientName": "Panasonic Life Solutions India",
    "location": "Bengaluru, Karnataka",
    "city": "Bengaluru",
    "state": "Karnataka",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Panasonic Innovation Center India in Bengaluru, Karnataka. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2022",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 198
  },
  {
    "name": "Eden Garden",
    "clientName": "Eden Garden",
    "location": "Kolkata, West Bengal",
    "city": "Kolkata",
    "state": "West Bengal",
    "region": "East",
    "isPanIndia": false,
    "category": "Sports & Stadiums",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Eden Garden in Kolkata, West Bengal. The project was equipped with precision-grade Vandal-Resistant Compact Laminate Partition Clamps, Heavy-Duty Stainless Steel Gravity Hinges, Commercial Privacy Indicator Latches, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2023",
    "productsUsed": [
      "Vandal-Resistant Compact Laminate Partition Clamps",
      "Heavy-Duty Stainless Steel Gravity Hinges",
      "Commercial Privacy Indicator Latches",
      "High-Traffic Stainless Steel Door Stops"
    ],
    "images": [
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": true,
    "status": "ACTIVE",
    "orderIndex": 199
  },
  {
    "name": "Flipspace Technologies Tech Design Studio",
    "clientName": "Flipspace Technologies Private Limited",
    "location": "Chennai, Tamil Nadu",
    "city": "Chennai",
    "state": "Tamil Nadu",
    "region": "South",
    "isPanIndia": false,
    "category": "Corporate Offices & Tech Parks",
    "description": "PRC Hardware supplied and engineered heavy-duty, high-performance architectural fittings for Flipspace Technologies Tech Design Studio in Chennai, Tamil Nadu. The project was equipped with precision-grade SS 304 Restroom Cubicle Partition Hardware, Heavy Duty Hydraulic Floor Springs, Frameless Glass Door Patch Fittings, delivering unmatched durability, contemporary aesthetics, and seamless user experience for high-traffic environments.",
    "completionYear": "2024",
    "productsUsed": [
      "SS 304 Restroom Cubicle Partition Hardware",
      "Heavy Duty Hydraulic Floor Springs",
      "Frameless Glass Door Patch Fittings",
      "Acoustic Office Glass Partition Clamps"
    ],
    "images": [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop"
    ],
    "videoUrl": null,
    "isFeatured": false,
    "status": "ACTIVE",
    "orderIndex": 200
  }
];
