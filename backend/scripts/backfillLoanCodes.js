import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../src/db/index.js";
import LoanApplication from "../src/models/LoanApplication.js";

const LOAN_TYPE_PREFIX = {
  personal: "P",
  home: "H",
  auto: "A",
  education: "E",
  business: "B",
  credit_card: "C",
};

async function backfillLoanCodes() {
  await connectDB();

  const loanTypes = await LoanApplication.distinct("loanType");
  console.log("Found loan types:", loanTypes);

  for (const type of loanTypes) {
    const prefix = LOAN_TYPE_PREFIX[type] || (type?.[0] || "X").toUpperCase();

    const existingWithCodes = await LoanApplication.find({
      loanType: type,
      loanCode: { $exists: true, $ne: null },
    }).select("loanCode");

    let maxSeq = 0;
    const regex = new RegExp(`^${prefix}(\\d+)$`);
    for (const doc of existingWithCodes) {
      const match = typeof doc.loanCode === "string" ? doc.loanCode.match(regex) : null;
      if (match) {
        const n = parseInt(match[1], 10);
        if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
      }
    }

    const missing = await LoanApplication.find({
      loanType: type,
      $or: [{ loanCode: { $exists: false } }, { loanCode: null }],
    }).sort({ submittedAt: 1, _id: 1 });

    console.log(`Type ${type}: prefix=${prefix}, existing max=${maxSeq}, missing=${missing.length}`);

    let seq = maxSeq;
    for (const loan of missing) {
      seq += 1;
      loan.loanCode = `${prefix}${seq}`;
      await loan.save();
    }
  }

  console.log("Loan code backfill complete.");
  await mongoose.connection.close();
}

backfillLoanCodes().catch((err) => {
  console.error("Error backfilling loan codes:", err);
  process.exit(1);
});
