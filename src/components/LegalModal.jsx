// NOTE TO OWNER: Before launching commercially, replace every instance of
// "BodMax (operated by an individual)" with your formed LLC name, e.g.
// "BodMax LLC, a Texas limited liability company", and update the address.

const EFFECTIVE_DATE = 'April 25, 2026'
const CONTACT_EMAIL = 'feedback@getbodmax.com'
const APP_URL = 'https://getbodmax.com'

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.2px' }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.75 }}>{children}</div>
    </div>
  )
}

function P({ children }) {
  return <p style={{ margin: '0 0 10px' }}>{children}</p>
}

function Ul({ items }) {
  return (
    <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
      {items.map((item, i) => <li key={i} style={{ marginBottom: 4 }}>{item}</li>)}
    </ul>
  )
}

function TermsContent() {
  return (
    <div>
      <Section title="1. Agreement to Terms">
        <P>These Terms of Service ("Terms") govern your access to and use of BodMax (the "App"), a fitness tracking application available at {APP_URL}. The App is operated by BodMax (operated by an individual based in Dallas, Texas) ("we," "us," or "our").</P>
        <P>By creating an account or using the App, you agree to be bound by these Terms. If you do not agree, do not use the App.</P>
        <P><strong>Effective Date:</strong> {EFFECTIVE_DATE}</P>
      </Section>

      <Section title="2. Eligibility">
        <P>You must be at least 13 years old to use BodMax. If you are between 13 and 17 years old, you represent that your parent or legal guardian has reviewed and agrees to these Terms on your behalf.</P>
        <P>By using the App, you represent that you meet the above age requirements and have the legal capacity to enter into this agreement.</P>
      </Section>

      <Section title="3. Account Registration">
        <P>You must create an account to use BodMax. You agree to:</P>
        <Ul items={[
          'Provide accurate, current, and complete information during registration',
          'Maintain the security of your account credentials',
          'Promptly notify us of any unauthorized access to your account',
          'Accept responsibility for all activity that occurs under your account',
        ]} />
        <P>We reserve the right to suspend or terminate accounts that violate these Terms or that contain false information.</P>
      </Section>

      <Section title="4. Free and Premium Services">
        <P><strong>Free Tier:</strong> BodMax offers core features at no charge, including basic workout tracking, session logging, and nutrition tracking.</P>
        <P><strong>Premium Subscription:</strong> Advanced features — including AI-powered coaching, AI workout generation, and other premium functionality — require a paid subscription at $5.00 USD per month ("Premium").</P>
        <P><strong>Billing:</strong> Premium subscriptions are billed monthly on a recurring basis. By subscribing, you authorize us to charge your payment method on a recurring basis until you cancel.</P>
        <P><strong>Cancellation:</strong> You may cancel your Premium subscription at any time through your account settings. Cancellation takes effect at the end of the current billing period; you will retain Premium access until that date.</P>
        <P><strong>Refunds:</strong> We do not provide refunds for partial billing periods. If you cancel mid-month, you will not be charged for the next month but will not receive a refund for the current month.</P>
        <P><strong>Price Changes:</strong> We may change the subscription price with at least 30 days' notice. Continued use after the price change takes effect constitutes acceptance of the new price.</P>
      </Section>

      <Section title="5. Prohibited Conduct">
        <P>You agree not to:</P>
        <Ul items={[
          'Use the App for any unlawful purpose or in violation of applicable law',
          'Attempt to gain unauthorized access to any part of the App or its systems',
          'Scrape, crawl, or extract data from the App using automated means',
          'Post or transmit any content that is harmful, abusive, obscene, or threatening',
          'Impersonate any person or entity',
          'Interfere with or disrupt the App\'s infrastructure or servers',
          'Reverse engineer, decompile, or disassemble any part of the App',
          'Use the App to send unsolicited communications to other users',
        ]} />
      </Section>

      <Section title="6. Health and Medical Disclaimer">
        <P><strong>BodMax is not a medical service and is not intended to diagnose, treat, cure, or prevent any disease or health condition.</strong></P>
        <P>The workout plans, nutritional guidance, progress tracking, and AI coaching features are provided for general fitness and informational purposes only. They do not constitute medical advice.</P>
        <P><strong>Before starting any new exercise program or making significant changes to your diet, consult with a qualified physician, registered dietitian, or licensed healthcare provider,</strong> especially if you have any pre-existing medical conditions, are pregnant, or have been previously injured.</P>
        <P>You acknowledge that physical exercise carries inherent risks, including injury. You assume full responsibility for your use of any information provided through the App and any resulting consequences.</P>
      </Section>

      <Section title="7. AI Features Disclaimer">
        <P>BodMax uses artificial intelligence (provided by Anthropic, Inc.) to power certain features including AI coaching, workout generation, and insights. You acknowledge that:</P>
        <Ul items={[
          'AI-generated content may contain errors or inaccuracies',
          'AI recommendations are not a substitute for advice from a certified personal trainer, coach, or medical professional',
          'We do not guarantee the accuracy, completeness, or fitness for purpose of any AI-generated content',
          'Your queries to the AI coach are processed by Anthropic\'s servers as described in our Privacy Policy',
          'The AI coach is restricted to fitness and nutrition topics only',
        ]} />
      </Section>

      <Section title="8. User Content">
        <P>You retain ownership of all content you submit to BodMax, including workout logs, photos, and personal data ("User Content").</P>
        <P>By submitting User Content, you grant us a limited, non-exclusive, royalty-free license to store, process, and display your User Content solely for the purpose of operating and improving the App for you.</P>
        <P>We do not sell your personal User Content to third parties.</P>
      </Section>

      <Section title="9. Intellectual Property">
        <P>The BodMax name, logo, app design, and all software code are owned by or licensed to us and are protected by applicable intellectual property laws. You may not copy, modify, distribute, or create derivative works from any part of the App without our prior written consent.</P>
      </Section>

      <Section title="10. Termination">
        <P>We may suspend or terminate your account at any time, with or without cause, with or without notice. Reasons for termination include, but are not limited to, violation of these Terms or conduct we determine is harmful to other users or to us.</P>
        <P>You may delete your account at any time by contacting us at {CONTACT_EMAIL}. Upon deletion, your personal data will be handled as described in our Privacy Policy.</P>
      </Section>

      <Section title="11. Disclaimers">
        <P>THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</P>
        <P>We do not warrant that the App will be uninterrupted, error-free, secure, or free of viruses or other harmful components.</P>
      </Section>

      <Section title="12. Limitation of Liability">
        <P>TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL WE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF DATA, LOSS OF PROFITS, OR PERSONAL INJURY, ARISING OUT OF OR RELATED TO YOUR USE OF THE APP.</P>
        <P>OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE APP SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR $10.00 USD, WHICHEVER IS GREATER.</P>
      </Section>

      <Section title="13. Governing Law & Disputes">
        <P>These Terms are governed by and construed in accordance with the laws of the State of Texas, without regard to its conflict of law principles.</P>
        <P>Any dispute arising from or related to these Terms or the App shall first be addressed through good-faith negotiation. If unresolved within 30 days, disputes shall be submitted to the exclusive jurisdiction of the state or federal courts located in Dallas County, Texas, and you consent to personal jurisdiction in those courts.</P>
      </Section>

      <Section title="14. Changes to These Terms">
        <P>We may update these Terms from time to time. If we make material changes, we will notify you by displaying a notice within the App or by email. Your continued use of the App after the effective date of revised Terms constitutes your acceptance of those changes.</P>
      </Section>

      <Section title="15. Contact">
        <P>Questions about these Terms? Contact us:</P>
        <P><strong>Email:</strong> {CONTACT_EMAIL}<br /><strong>Website:</strong> {APP_URL}<br /><strong>Location:</strong> Dallas, Texas, USA</P>
      </Section>
    </div>
  )
}

function PrivacyContent() {
  return (
    <div>
      <Section title="Introduction">
        <P>BodMax ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, share, and protect information when you use our fitness tracking application available at {APP_URL}.</P>
        <P><strong>Effective Date:</strong> {EFFECTIVE_DATE}</P>
        <P>By using BodMax, you agree to the collection and use of information as described in this policy.</P>
      </Section>

      <Section title="1. Information We Collect">
        <P><strong>Account Information:</strong> When you register, we collect your email address (via Supabase authentication) and the profile details you provide: name, username, and password (stored as a secure hash).</P>
        <P><strong>Profile & Fitness Data:</strong> Information you enter into the App including:</P>
        <Ul items={[
          'Body metrics: bodyweight, body measurements (chest, waist, hips, arms, thighs, neck, body fat %)',
          'Fitness goals and preferences: goal (bulk/cut/maintain), athlete type, preferred unit system',
          'Nutrition targets: daily calorie, protein, carbohydrate, and fat goals',
          'Workout sessions: exercises performed, sets, reps, weights, duration, cardio activity',
          'Diet logs: food names, calories, and macronutrient data you log',
          'Personal records (PRs) for exercises',
          'Weekly workout split preferences',
          'Progress photos you choose to upload',
          'Custom exercises and saved meal templates',
        ]} />
        <P><strong>AI Coaching Data:</strong> When you use the AI coaching features, your questions and relevant fitness context (recent sessions, profile data) are sent to Anthropic, Inc. for processing. See "Third-Party Services" below.</P>
        <P><strong>Social Data:</strong> Friend connections, session likes, and comments you make on other users' workouts.</P>
        <P><strong>Communications:</strong> Feedback and support messages you submit through the App.</P>
        <P><strong>Technical Data:</strong> Basic usage data, device type, IP address, and browser information collected automatically by our infrastructure providers (Cloudflare, Vercel) when you access the App.</P>
      </Section>

      <Section title="2. How We Use Your Information">
        <Ul items={[
          'To provide, operate, and improve the App and its features',
          'To personalize your experience (AI coaching, workout suggestions, nutrition tracking)',
          'To calculate and display your fitness stats, rankings, and progress',
          'To send transactional emails (password resets, notifications) via Resend',
          'To respond to your feedback and support requests',
          'To enforce our Terms of Service and prevent abuse',
          'To analyze aggregate, anonymized usage patterns to improve the App',
        ]} />
        <P>We do not use your personal data for advertising or sell it to data brokers.</P>
      </Section>

      <Section title="3. How We Share Your Information">
        <P>We share data only with the service providers necessary to operate BodMax. All providers are contractually bound to use your data only to perform services for us.</P>
        <P><strong>Supabase, Inc.</strong> — Database hosting and user authentication. Your data is stored on Supabase-managed servers. <em>supabase.com</em></P>
        <P><strong>Vercel, Inc.</strong> — Application hosting and content delivery. Vercel processes request logs. <em>vercel.com</em></P>
        <P><strong>Cloudflare, Inc.</strong> — DNS, CDN, and DDoS protection. Cloudflare processes network traffic. <em>cloudflare.com</em></P>
        <P><strong>Resend, Inc.</strong> — Transactional email delivery (password resets, notifications). Only your email address and the content of the notification are shared. <em>resend.com</em></P>
        <P><strong>Anthropic, Inc.</strong> — AI features. When you use AI coaching or workout generation, your message and summarized fitness context are sent to Anthropic's API. Anthropic's privacy policy governs their use of this data. <em>anthropic.com/privacy</em></P>
        <P>We may also disclose information if required by law, court order, or government authority, or to protect the rights, property, or safety of BodMax, our users, or the public.</P>
        <P>We do not sell your personal information to any third party.</P>
      </Section>

      <Section title="4. Social Features">
        <P>If you use social features, certain information may be visible to other BodMax users:</P>
        <Ul items={[
          'Your name and username are visible to users you connect with as friends',
          'Completed workout sessions (exercise names, volume, duration) are visible to your friends in their feed',
          'Comments you post on friend workouts are visible to those friends',
        ]} />
        <P>Your email address, nutrition data, body measurements, and bodyweight are never shared with other users.</P>
      </Section>

      <Section title="5. Children's Privacy (COPPA)">
        <P>BodMax requires users to be at least 13 years of age. We do not knowingly collect personal information from children under 13. If we discover that a child under 13 has provided personal information, we will promptly delete it.</P>
        <P>Users between 13 and 17 years old may use BodMax with parental or guardian consent. Parents or guardians who believe their child has provided information without consent should contact us at {CONTACT_EMAIL}.</P>
        <P>We do not direct marketing to users under 18.</P>
      </Section>

      <Section title="6. Data Retention">
        <P>We retain your personal data for as long as your account is active. If you delete your account, we will delete your personal data within 30 days, except where retention is required by law or legitimate business purposes (such as resolving disputes or fraud prevention).</P>
        <P>Aggregated, anonymized data may be retained indefinitely for analytics purposes.</P>
      </Section>

      <Section title="7. Your Rights & Choices">
        <P>You have the right to:</P>
        <Ul items={[
          'Access and export your data (contact us to request a data export)',
          'Correct inaccurate data (via the Edit Profile screen in the App)',
          'Delete your account and associated data (contact us at the email below)',
          'Opt out of non-essential communications (you can disable push notifications in your device settings)',
        ]} />
        <P>To exercise any of these rights, contact us at {CONTACT_EMAIL}. We will respond within 30 days.</P>
      </Section>

      <Section title="8. Data Security">
        <P>We implement industry-standard security measures to protect your data, including:</P>
        <Ul items={[
          'Encryption in transit (HTTPS/TLS) for all data transmitted to and from the App',
          'Encryption at rest for database storage via Supabase',
          'Row-level security policies on our database so users can only access their own data',
          'Secure password hashing — we never store plain-text passwords',
        ]} />
        <P>No method of transmission over the internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.</P>
      </Section>

      <Section title="9. Changes to This Policy">
        <P>We may update this Privacy Policy from time to time. If we make material changes, we will notify you through the App or by email before the changes take effect. Your continued use of the App after the effective date of the revised policy constitutes your acceptance.</P>
      </Section>

      <Section title="10. Contact">
        <P>For privacy-related questions, data requests, or to report a concern:</P>
        <P><strong>Email:</strong> {CONTACT_EMAIL}<br /><strong>Website:</strong> {APP_URL}<br /><strong>Location:</strong> Dallas, Texas, USA</P>
      </Section>
    </div>
  )
}

export default function LegalModal({ doc, onClose }) {
  const isTerms = doc === 'terms'
  const title = isTerms ? 'Terms of Service' : 'Privacy Policy'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Last updated: {EFFECTIVE_DATE}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 24, lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '20px 20px 48px', flex: 1, WebkitOverflowScrolling: 'touch' }}>
          {isTerms ? <TermsContent /> : <PrivacyContent />}
        </div>
      </div>
    </div>
  )
}
