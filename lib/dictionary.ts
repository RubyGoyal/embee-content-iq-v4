/**
 * Embee Software canonical solution dictionary.
 * Single source of truth for solution naming across all content.
 * Sourced from embee.co.in navigation + Microsoft/SAP partner guidelines.
 */

export interface DictEntry {
  approved: string;
  bad: string[];
  category: "microsoft" | "sap" | "security" | "embee";
}

export const SOLUTION_DICT: DictEntry[] = [
  // Microsoft
  { approved: "Microsoft 365", bad: ["Office 365", "MS 365", "MS Office 365"], category: "microsoft" },
  { approved: "Microsoft 365 Copilot", bad: ["MS Copilot", "M365 Copilot", "Office Copilot"], category: "microsoft" },
  { approved: "Microsoft Teams", bad: ["MS Teams"], category: "microsoft" },
  { approved: "Microsoft SharePoint", bad: ["MS SharePoint", "Sharepoint"], category: "microsoft" },
  { approved: "Microsoft Fabric", bad: ["MS Fabric", "Azure Fabric"], category: "microsoft" },
  { approved: "Microsoft Power Platform", bad: ["MS Power Platform", "Power Suite"], category: "microsoft" },
  { approved: "Microsoft Viva Insights", bad: ["MS Viva", "Viva"], category: "microsoft" },
  { approved: "Windows 365", bad: ["Win 365", "Cloud PC Windows"], category: "microsoft" },
  { approved: "Azure", bad: ["MS Azure", "Azure Cloud by Microsoft"], category: "microsoft" },
  { approved: "Azure Virtual Desktop", bad: ["Windows Virtual Desktop", "WVD"], category: "microsoft" },
  { approved: "Azure Kubernetes Service", bad: ["Kubernetes Azure"], category: "microsoft" },
  // SAP
  { approved: "SAP S/4HANA", bad: ["S4 HANA", "S4/HANA", "SAP S4 HANA"], category: "sap" },
  { approved: "SAP Business One", bad: ["SAP BusinessOne", "Business 1", "SAP-B1"], category: "sap" },
  { approved: "SAP on Azure", bad: ["SAP/Azure", "SAP Azure"], category: "sap" },
  { approved: "RISE with SAP", bad: ["Rise SAP", "RISE-SAP"], category: "sap" },
  // Security
  { approved: "Zero Trust", bad: ["ZeroTrust", "Zero-Trust"], category: "security" },
  { approved: "SIEM/SOAR", bad: ["SIEM-SOAR", "SIEM and SOAR"], category: "security" },
  { approved: "Identity and Access Management", bad: ["ID&AM", "I&AM"], category: "security" },
  { approved: "Managed Security Services", bad: ["Security Services"], category: "security" },
  // Embee proprietary
  { approved: "Octane HRMS", bad: ["octane hrms", "OctaneHRMS", "Octane Hr"], category: "embee" },
  { approved: "ARth", bad: ["Arth receivables", "ARTH app"], category: "embee" },
  { approved: "EmSupport", bad: ["Em Support", "Embee Support"], category: "embee" },
];

export const JARGON_PHRASES = [
  "best-in-class", "best in class", "cutting-edge", "cutting edge",
  "synergy", "synergies", "one-stop shop", "one stop shop",
  "leverage", "leveraging", "next-generation", "world-class",
  "state-of-the-art", "game-changer", "seamless", "seamlessly",
  "holistic", "robust", "paradigm", "mission-critical", "turnkey",
  "empower", "empowering",
];

export const PROOF_POINTS = [
  "2500+ organizations", "1500+ engagements", "34+ years",
  "500+ cloud engineers", "Microsoft Solutions Partner",
  "Partner of the Year", "Microsoft Fabric Featured Partner",
  "#1 in APAC", "APAC",
];
