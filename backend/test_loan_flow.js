// Quick test to verify loan submission and fetching works
import axios from 'axios';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from './src/models/User.js';
import LoanApplication from './src/models/LoanApplication.js';

const API_URL = 'http://localhost:8000/api';
const MONGO_URI = 'mongodb+srv://prathamrs09_db_user:credit@credit.eifteob.mongodb.net/?appName=CREDIT';
const DB_NAME = 'credit';
const JWT_SECRET = 'altcreditsecret';

async function testFlow() {
  try {
    console.log('\n🧪 LOAN SUBMISSION & FETCH TEST\n');

    // Connect to DB
    console.log('1️⃣ Connecting to MongoDB...');
    await mongoose.connect(`${MONGO_URI}/${DB_NAME}`, { serverSelectionTimeoutMS: 5000 });
    console.log(' Connected\n');

    // Create test user
    console.log('2️⃣ Creating test user...');
    let testUser = await User.findOne({ email: 'test-loan@example.com' });
    if (!testUser) {
      testUser = await User.create({
        fullName: 'Test Borrower',
        email: 'test-loan@example.com',
        phone: '9876543210',
        password: 'test123',
        role: 'user',
        isOnBoarded: true
      });
      console.log(' User created:', testUser._id);
    } else {
      console.log(' User exists:', testUser._id);
    }

    // Generate token
    console.log('\n3️⃣ Generating JWT token...');
    const token = jwt.sign({ userId: testUser._id, role: 'user' }, JWT_SECRET, { expiresIn: '24h' });
    console.log(' Token generated\n');

    // Submit loan via API
    console.log('4️⃣ Submitting loan via API...');
    const loanPayload = {
      loanType: 'personal',
      requestedAmount: 75000,
      requestedTenure: 12,
      purpose: 'Test',
      age: 30
    };

    console.log('   📤 Payload:', JSON.stringify(loanPayload, null, 2));

    const submitRes = await axios.post(`${API_URL}/loan/apply`, loanPayload, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const loanId = submitRes.data.data?.loanId;
    console.log(' Loan submitted');
    console.log('   Loan ID:', loanId);
    console.log('   Status:', submitRes.data.data?.status);
    console.log('   HTTP:', submitRes.status);

    // Fetch loans via API
    console.log('\n5️⃣ Fetching loans via API (/loan/my-loans)...');
    const fetchRes = await axios.get(`${API_URL}/loan/my-loans`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log(' Loans fetched');
    console.log('   HTTP:', fetchRes.status);
    console.log('   Total loans:', fetchRes.data.loans?.length || 0);

    // Check if our loan is there
    const foundLoan = fetchRes.data.loans?.find((l) => l._id === loanId);
    if (foundLoan) {
      console.log('    OUR JUST-SUBMITTED LOAN FOUND!');
      console.log('      Amount:', foundLoan.requestedAmount);
      console.log('      Status:', foundLoan.status);
      console.log('      UserId:', foundLoan.userId);
    } else {
      console.log('   LOAN NOT FOUND IN RESPONSE!');
    }

    // Verify in database
    console.log('\n6️⃣ Verifying in MongoDB...');
    const dbLoan = await LoanApplication.findById(loanId).populate('userId');
    if (dbLoan) {
      console.log(' Loan exists in DB');
      console.log('   _id:', dbLoan._id);
      console.log('   userId:', dbLoan.userId._id);
      console.log('   Amount:', dbLoan.requestedAmount);
      console.log('   Status:', dbLoan.status);
    } else {
      console.log('Loan not in database!');
    }

    console.log('\n TEST COMPLETE\n');
    process.exit(0);

  } catch (error) {
    console.error('\nTEST FAILED');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

testFlow();
