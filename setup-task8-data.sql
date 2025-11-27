-- =========================================
-- Task 8: Setup Business Context and FAQs
-- =========================================

-- Step 1: Get your organization ID
-- Run this first to find your orgId:
SELECT id, name, slug FROM organizations ORDER BY "createdAt" DESC LIMIT 5;

-- Step 2: Update Settings with Business Context
-- Replace 'YOUR_ORG_ID_HERE' with your actual orgId from Step 1

UPDATE settings 
SET 
  "businessName" = 'Acme Design Studio',
  "businessDescription" = 'We are a professional interior design company specializing in residential and commercial spaces. Our team of experienced designers creates beautiful, functional environments that reflect your unique style and needs.',
  "servicesText" = 'Our Services:
• Interior Design Consultations - Personalized design advice for your space
• 3D Visualization - See your space before we transform it
• Full Room Makeovers - Complete design and installation
• Furniture Selection - Curated pieces that match your style
• Color Consulting - Expert color schemes and palettes
• Space Planning - Optimize your layout for functionality',
  "hoursText" = 'Business Hours:
Monday - Friday: 9:00 AM - 6:00 PM
Saturday: 10:00 AM - 4:00 PM
Sunday: Closed

We also offer appointments outside regular hours by special arrangement.',
  "locationText" = 'Main Office:
123 Design Street
Downtown
New York, NY 10001

We serve the entire NYC metro area including all five boroughs. For projects outside this area, please contact us to discuss travel arrangements.',
  "schedulingNote" = 'Appointment Scheduling:
All appointments are scheduled by our team to ensure we have the right designer available for your project. After you request an appointment, our team will:
1. Review your project needs
2. Match you with the best designer
3. Confirm your appointment within 24 hours
4. Send you a calendar invite

We offer both in-person consultations at our office and virtual meetings via video call.'
WHERE "orgId" = 'YOUR_ORG_ID_HERE';

-- Step 3: Verify Settings Update
SELECT 
  "orgId",
  "businessName",
  LEFT("businessDescription", 50) || '...' as description_preview,
  "agentName",
  "autoReply",
  "autoFollowup"
FROM settings 
WHERE "orgId" = 'YOUR_ORG_ID_HERE';

-- Step 4: Create Sample FAQs
-- Replace 'YOUR_ORG_ID_HERE' with your actual orgId

-- FAQ 1: Pricing
INSERT INTO business_faqs ("id", "orgId", "question", "answer", "tags", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'YOUR_ORG_ID_HERE',
  'What are your pricing packages?',
  'We offer three main packages to suit different needs and budgets:

• Basic Package ($500): Single room consultation with design recommendations and mood board
• Standard Package ($1,500): Full room design including 3D visualization, furniture selection, and shopping list
• Premium Package ($3,000+): Complete room makeover including design, furniture procurement, and professional installation

Custom packages are also available. The final price depends on room size, complexity, and your specific requirements. Contact us for a free initial consultation and personalized quote!',
  ARRAY['pricing', 'packages', 'cost', 'rates'],
  true,
  NOW(),
  NOW()
);

-- FAQ 2: Free Consultation
INSERT INTO business_faqs ("id", "orgId", "question", "answer", "tags", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'YOUR_ORG_ID_HERE',
  'Do you offer free consultations?',
  'Yes! We offer a complimentary 30-minute initial consultation for all new clients. During this consultation, we will:
• Discuss your project goals and vision
• Review your space and requirements
• Answer your questions about our process
• Provide general design advice
• Give you a project estimate

This consultation can be done in-person at our office, at your location, or via video call. Book your free consultation today!',
  ARRAY['consultation', 'free', 'initial', 'meeting'],
  true,
  NOW(),
  NOW()
);

-- FAQ 3: Service Area
INSERT INTO business_faqs ("id", "orgId", "question", "answer", "tags", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'YOUR_ORG_ID_HERE',
  'What areas do you serve?',
  'We primarily serve the New York City metropolitan area, including:
• Manhattan
• Brooklyn
• Queens
• Bronx
• Staten Island
• Parts of Westchester County
• Northern New Jersey

For projects outside this area, please contact us. We may be able to accommodate your project with additional travel fees, or we can offer virtual design services for clients anywhere in the United States.',
  ARRAY['location', 'service-area', 'coverage', 'geography'],
  true,
  NOW(),
  NOW()
);

-- FAQ 4: Timeline
INSERT INTO business_faqs ("id", "orgId", "question", "answer", "tags", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'YOUR_ORG_ID_HERE',
  'How long does a typical project take?',
  'Project timelines vary based on scope and complexity:

• Consultation Only: 1-2 weeks for deliverables after meeting
• Standard Design (no installation): 2-4 weeks from consultation to final design
• Full Room Makeover: 4-8 weeks from start to completion

Timelines can be affected by:
• Furniture lead times (2-8 weeks for custom pieces)
• Your decision-making speed
• Contractor availability (if structural changes needed)
• Product availability

We provide a detailed timeline during your initial consultation and keep you updated throughout the project.',
  ARRAY['timeline', 'duration', 'how-long', 'schedule'],
  true,
  NOW(),
  NOW()
);

-- FAQ 5: Design Style
INSERT INTO business_faqs ("id", "orgId", "question", "answer", "tags", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'YOUR_ORG_ID_HERE',
  'What design styles do you specialize in?',
  'Our experienced team works with a wide range of design styles, including:

• Modern & Contemporary
• Traditional & Classic
• Transitional (blend of modern and traditional)
• Industrial & Urban
• Scandinavian & Minimalist
• Bohemian & Eclectic
• Mid-Century Modern
• Coastal & Beach House

We don''t limit ourselves to one style - we specialize in understanding YOUR style and bringing your vision to life. During the consultation, we discuss your preferences, lifestyle, and inspirations to create a space that feels authentically you.',
  ARRAY['style', 'design', 'aesthetic', 'modern', 'traditional'],
  true,
  NOW(),
  NOW()
);

-- FAQ 6: What to Expect
INSERT INTO business_faqs ("id", "orgId", "question", "answer", "tags", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'YOUR_ORG_ID_HERE',
  'What should I expect during the design process?',
  'Our design process is collaborative and transparent:

1. Initial Consultation (30 min free)
   • Discuss your vision, needs, and budget
   • Review your space
   
2. Design Proposal (1-2 weeks)
   • Detailed project scope and timeline
   • Pricing breakdown
   • Contract and agreement
   
3. Design Development (2-3 weeks)
   • Space measurements and planning
   • Mood boards and style direction
   • Furniture and material selections
   • 3D renderings (Standard package and above)
   
4. Review & Revisions
   • Present complete design
   • Make adjustments based on your feedback
   • Finalize all selections
   
5. Implementation (varies)
   • Order furniture and materials
   • Coordinate delivery and installation
   • Final styling and finishing touches

You''re involved at every stage and we welcome your feedback throughout!',
  ARRAY['process', 'how-it-works', 'steps', 'what-to-expect'],
  true,
  NOW(),
  NOW()
);

-- FAQ 7: Payment
INSERT INTO business_faqs ("id", "orgId", "question", "answer", "tags", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'YOUR_ORG_ID_HERE',
  'What are your payment terms?',
  'Our payment structure is straightforward:

• Initial Consultation: Free
• Design Fee: 50% due upon contract signing, 50% upon design completion
• Furniture & Materials: Paid directly to vendors or through us with a 15% procurement fee

We accept:
• Credit/Debit Cards (Visa, Mastercard, Amex)
• Bank Transfers
• Checks

For larger projects over $10,000, we can arrange payment plans. Payment schedules are detailed in your contract, and we never ask for full payment upfront. Our goal is to make beautiful design accessible and stress-free!',
  ARRAY['payment', 'pricing', 'terms', 'cost', 'deposit'],
  true,
  NOW(),
  NOW()
);

-- FAQ 8: Commercial Projects
INSERT INTO business_faqs ("id", "orgId", "question", "answer", "tags", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'YOUR_ORG_ID_HERE',
  'Do you work on commercial spaces?',
  'Yes! We work on a variety of commercial projects including:
• Offices and Coworking Spaces
• Retail Stores and Boutiques
• Restaurants and Cafes
• Salons and Spas
• Medical and Dental Offices
• Hotels and Hospitality

Commercial projects follow a similar process but with additional considerations for:
• Brand identity and customer experience
• Compliance with commercial building codes
• Durability and high-traffic requirements
• ROI and business objectives

Contact us to discuss your commercial project. We have a dedicated team experienced in creating beautiful, functional commercial spaces that drive business success.',
  ARRAY['commercial', 'business', 'office', 'retail', 'restaurant'],
  true,
  NOW(),
  NOW()
);

-- Step 5: Verify FAQs Created
SELECT 
  COUNT(*) as total_faqs,
  SUM(CASE WHEN "isActive" = true THEN 1 ELSE 0 END) as active_faqs
FROM business_faqs 
WHERE "orgId" = 'YOUR_ORG_ID_HERE';

-- Step 6: View All FAQs
SELECT 
  LEFT("question", 50) as question_preview,
  LEFT("answer", 100) as answer_preview,
  array_length("tags", 1) as num_tags,
  "isActive"
FROM business_faqs 
WHERE "orgId" = 'YOUR_ORG_ID_HERE'
ORDER BY "createdAt" DESC;

-- =========================================
-- Quick Test Queries
-- =========================================

-- Get full settings for your org
SELECT * FROM settings WHERE "orgId" = 'YOUR_ORG_ID_HERE';

-- Get all FAQs with full content
SELECT * FROM business_faqs WHERE "orgId" = 'YOUR_ORG_ID_HERE' ORDER BY "createdAt";

-- Search FAQs by tag
SELECT "question", "answer" 
FROM business_faqs 
WHERE "orgId" = 'YOUR_ORG_ID_HERE' 
  AND 'pricing' = ANY("tags")
  AND "isActive" = true;

-- Check recent conversations to test with
SELECT 
  c.id,
  c.intent,
  c."subIntent",
  c."leadScore",
  c."requiresHuman",
  COUNT(m.id) as message_count
FROM conversations c
LEFT JOIN messages m ON m."conversationId" = c.id
WHERE c."orgId" = 'YOUR_ORG_ID_HERE'
GROUP BY c.id
ORDER BY c."createdAt" DESC
LIMIT 10;
