// Loan Application Session Management
// Saves form state to sessionStorage and restores it on page refresh

interface LoanFormState {
  step: number;
  applicantType: "banked" | "unbanked" | null;
  loanType: string | null;
  incomeRange: string;
  hasExistingLoan: string;
  existingEmi: string;
  dependents: string;
  coApplicant: string;
  loanAmount: number[];
  tenure: string;
  occupation: string;
  gender: string;
  maritalStatus: string;
  familyMembersCount: string;
  childrenCount: string;
  dateOfBirth: string;
  age: string;
  // Personal documents
  identityFile: string | null;
  financialFile: string | null;
  // Education
  courseName: string;
  university: string;
  studyLocation: string;
  courseDuration: string;
  // Home
  homeArea: string;
  bhk: string;
  homeLocation: string;
  estimatedPrice: string;
  propertyDocument: string | null;
  // Auto
  autoType: string;
  autoModel: string;
  autoPrice: string;
  autoDetails: string;
  autoDocument: string | null;
  // Business
  businessType: "" | "msme" | "large";
  msmeCertificate: string | null;
  // Biometrics
  faceScanImage: string | null;
  coAppFaceScanImage: string | null;
  // Alternate underwriting
  alternateDataConsent: boolean;
  upiMonthlyInflow: string;
  upiMonthlyOutflow: string;
  avgMonthlyTransactionCount: string;
  transactionRegularity: string;
  upiInflowVariance: string;
  gstConsistency: string;
  utilityPaymentRegularity: string;
  rentPaymentConsistency: string;
  declaredMonthlyIncome: string;
  employmentOrBusinessType: string;
  monthsUpiHistory: string;
  monthsGstHistory: string;
  monthsUtilityHistory: string;
  monthsRentHistory: string;
  quickApplyUnbanked: boolean;
  alternateReferenceId: string;
  alternateReferenceIdType: "pan" | "bank_account_masked" | "other";
  hasUpiHint: boolean;
  hasUtilityHint: boolean;
}

const SESSION_KEY = "loan_application_session";

export const loanSessionService = {
  // Save the entire form state
  saveFormState: (state: Partial<LoanFormState>) => {
    try {
      const existing = sessionStorage.getItem(SESSION_KEY);
      const currentState = existing ? JSON.parse(existing) : {};
      const updated = { ...currentState, ...state };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to save form state:", error);
    }
  },

  // Load the saved form state
  loadFormState: (): Partial<LoanFormState> | null => {
    try {
      const state = sessionStorage.getItem(SESSION_KEY);
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error("Failed to load form state:", error);
      return null;
    }
  },

  // Clear the session (call after successful submission)
  clearFormState: () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (error) {
      console.error("Failed to clear form state:", error);
    }
  },

  // Check if there's a saved session
  hasSavedSession: (): boolean => {
    try {
      return !!sessionStorage.getItem(SESSION_KEY);
    } catch (error) {
      return false;
    }
  },
};
