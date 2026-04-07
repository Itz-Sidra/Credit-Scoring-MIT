# CREDIT Loan Application - User Flow Documentation

## Overview
This document covers the end-to-end user journey for the "Apply For Loan" feature inside the CREDIT application. The funnel dynamically adapts, requesting different inputs and documents based on the **Loan Type** and the user's **Occupation**.

---

## The Workflow & Fields Captured

### Step 0: Loan Selection (Initial Choice)
This screen kicks off the funnel.
- **Loan Category** (Required): Personal, Education, Home, Auto, Business, Credit Card.

### Step 1: Identity & KYC Verification / Pre-Requisites
Establishes the base identity and compliance documentation.
- **Identity Proof Upload** (Required): Pan Card / Aadhar Card photo capture or upload.
- **Selfie/Face Scan** (Required): Live camera capture of the applicant.
- **Co-applicant Face Scan** (Required only if a co-applicant is attached in earlier or later steps).

*(Note: Educational loans skip generic occupation selection and immediately ask for "Family Income Range" and "Co-applicant Name & Relationship" here).*

### Step 2: Loan Configuration
Configures the actual financial request parameters.
- **Loan Amount** (Required): Dynamic slider range restricted based on the selected loan type (e.g., ₹5L - ₹5Cr+ for Home Loans, ₹10K - ₹10L for generic Personal loans).
- **Tenure** (Required): Selectable from 6, 12, 24, 36, or 60 months.
- **Occupation Category** (Required for non-education loans): Salaried, Self-employed, Farmer, Homemaker, Retired, Gig Worker, Student, Unemployed.
- **EMI Risk Metric** (*Calculated factor*): Provides immediate feedback on financial health by rating the calculated EMI against assumed bracketed incomes.

**For Business Loans Only:**
- **Enterprise Type** (Required): Choice between MSME or Large Enterprise.
- **MSME Certificate / Udyam Registration** (Required if MSME is selected).

### Step 3: Additional Details & Financials
This heavily branched step is customized according to both the Loan Type and the applicant's Occupation to extract deep demographic metrics.

**General Global Fields:**
- **Loan Purpose** (Required): Brief text description of what the loan is intended for.

**Dynamic Occupation Questions:**
- **Salaried**: Company Name, Employment Type (Permanent/Contract/Temp), Years in Current Job, Total Work Experience.
- **Self-employed / Business**: Business Type (e.g., Retail), Business Age (years), Average Monthly Revenue (bracket selected), Monthly Profit, Income Consistency.
- **Gig Worker**: Platform Name (e.g., Swiggy, Uber), Duration of Work (months), Average Monthly Income, Weekly Hours, Income Consistency. *Includes a checkbox to formally confirm active gig employment.*
- **Homemaker / Student / Unemployed**: Asks about Co-Applicant presence. If 'Yes': Co-applicant Name, Relationship, and Income Range. If 'No': Checks for physical/financial asset ownership (Asset Type, Asset Value).
- **Farmer**: Land Ownership (Owned/Leased), Total Area (Acres), Primary Crop Type, Estimated Seasonal Income, Other Income Sources.
- **Retired**: Monthly Pension Amount, Dependents, Average Monthly Expenses, Other Income Sources.

**Dynamic Loan-Type Questions:**
- **Home Loan**: Property Location/City, Configuration (1 BHK / 2 BHK / Plot), Carpet Area (Sq. Ft.), Estimated Price / Valuation.
- **Auto Loan**: Automobile Type (Car, Two-Wheeler, Commercial), Model & Brand, On-Road Cost, Variant/Additional Info.
- **Education Loan**: Course Name, Admission Status (Confirmed/Pending), University Name, Study Location (Domestic/International), Course Duration, Estimated Total Cost, Request Type (Secured vs. Unsecured).

**Optional & Mandatory Document Flow:**
- *General Optional*: Bank Statement (Last 3-6 months)
- *Salaried Optional*: Salary Slips (Last 3 months)
- *Self-Employed Optional*: Business Proof (GST/Registration)
- *Gig Worker Optional*: Platform Setup Screenshot
- *Farmer Optional*: Land Proof (Khasra/Khatauni or lease document)
- *Unemployed/Student Optional*: Asset Proof Document
- **Home Loan (Mandatory)**: Property Document / Agreement
- **Auto Loan (Mandatory)**: Vehicle Quote / Dealership Document
- **Education Loan (Mandatory)**: Admission Letter / Fee Structure

**Final Legal Consent:**
- **Declaration / Consent Checkbox** (Required): "I confirm that the information provided is true to the best of my knowledge and I authorize Barclay's to verify these details." Must be actively ticked to proceed.

### Step 4: Final Review & Submit
- Summarizes the finalized loan request (Amount, Calculated Total Payable Interest, Tenure, Output EMI).
- Recaps applicant demographics and co-applicant summaries.
- Provides an AI-simulated "Application Snapshot" highlighting the predictive approval odds directly before submission.
- User can opt to hit "Edit Details" to traverse backward or "Submit Application" to finalize.

---

## Metrics, Rules & Validations

1. **EMI Affordability Rules**:
   - The system maps income brackets to static integer baselines (e.g., <2L maps to ₹15,000/mo base for formulas).
   - If the `(EMI / Monthly Income) * 100` ratio exceeds **40%**, the application is visually flagged to the user as "High Risk".
   - If the ratio is between **30% - 40%**, it is "Manageable".
   - If the ratio is **below 30%**, it is "Comfortable".
2. **Strict Step Gating**: 
   - Users completely cannot proceed past Step 1 without uploading or capturing a selfie through the virtual webcam.
   - Users cannot pass Step 2 without specifying an occupation, or, specifically for Business loans, unconditionally uploading an MSME certificate. 
   - Home, Auto, and Education loans inherently demand specific contractual file uploads (property deed, car quote, university acceptance letter) prior to form submission.
3. **Data Parity & Admin Dashboard Delivery**: 
   - Upon finalization, the granular data inputs across Step 3 (such as "BHK", "Course Name", "Auto Model") are condensed dynamically into a `customDetails` JSON Object.
   - Using browser `localStorage` binding, this customized payload directly populates the `AdminLoanApplications.tsx` dashboard without manual mapping noise or default assumptions, simulating strict frontend-backend database integration. All documents attached correspond cleanly to clickable viewing triggers for an Admin inspector.
