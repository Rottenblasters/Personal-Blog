/*
 * EDIT THIS FILE TO UPDATE YOUR PORTFOLIO.
 *
 * Add education, experience, and projects below.
 * Place the résumé PDF under resume/ and case-study Markdown under projects/, then update paths below.
 */
window.PORTFOLIO_CONTENT = {
  profile: {
    name: "Anshul Singh",
    role: "ML Systems & Mobile Systems Engineer",
    location: "New York, NY",
    intro:
      "I build high-scale iOS, Android, and React Native platforms — focused on performance, reliability, and systems that ship at consumer scale.",
    aboutHeadline:
      "Hi, I'm Anshul, an MS in Computer Science candidate at NYU Courant and a former Senior Software Engineer.",
    about: [
      "Prior to landing in New York City, I spent 3+ years architecting high-scale mobile and backend platforms serving over 70 million monthly active users. At Myntra, I worked on the core StoreFront team, owning app releases, optimizing mobile performance and building foundational platforms like Myntra’s dynamic UI Layout Engine and mobile Performance Monitoring framework, which eventually led to my promotion to Senior Software Engineer. I started my career as an early engineer at the fintech startup FlyFin AI where we worked towards making tax filing seamless for US taxpayers. As an early engineer it was a high-stakes environment that sharpened my ability to design resilient backend and frontend systems.",
      "Now at NYU, I am shifting my focus toward the intersection of Systems Engineering and Artificial Intelligence. As data privacy strictness and cloud API costs reach a boiling point, the future of AI won't belong exclusively to third-party API calls. Engineers will need to innovate ways to run, fine-tune, and serve models locally on enterprise on-premise infrastructure. Thus making state-of-the-art AI performant on constrained CPU and GPU environments is important as not every company has an OpenAI-sized compute cluster. Through my background in low-level platform optimization and the AI research culture at NYU Courant I aim to work towards this future.",
    ],
    email: "mail.anshul.singh@gmail.com",
    resume: "resume/Anshul_Singh_Resume.pdf",
    social: {
      github: "https://github.com/",
      linkedin: "https://www.linkedin.com/in/anshul-singh-b58790197/",
    },
    skills: [
      "Mobile Engineering",
      "React Native",
      "Android & iOS",
      "Kotlin Multiplatform",
      "Performance",
      "ML Systems",
      "Applied AI",
      "System Design",
    ],
  },

  education: [
    {
      school: "New York University (Courant)",
      location: "New York, USA",
      degree: "Master of Science in Computer Science",
      dates: "Aug 2026 – Present",
    },
    {
      school: "Indian Institute of Technology (BHU) Varanasi",
      location: "India",
      degree: "Bachelor of Technology in Metallurgical Engineering",
      dates: "Aug 2019 – June 2023",
    },
  ],

  experience: [
    {
      company: "Myntra",
      url: "https://www.myntra.com/",
      logo: "assets/companies/myntra.png",
      roles: [
        {
          title: "Senior Software Engineer",
          dates: "Jan 2026 – July 2026",
          bullets: [
            "Architected Armitage, a cross-platform mobile performance monitoring system using Kotlin Multiplatform (KMP) and React Native JSI to track real-time UI/JS FPS, CPU, memory, and launch vitals across iOS and Android with under 2% CPU overhead and 0.5% measurement deviation.",
            "Modernized core mobile platform infrastructure by migrating Android to API 35 (Edge-to-Edge and 16KB page-size support) and upgrading React Native to 0.78.3 with React 19, accelerating overall application runtime.",
            "Spearheaded the Layout Engine-driven Category Browsing page revamp, improving responsiveness, enabling scalable experimentation and reducing user steps to PDP across high-traffic shopping journeys.",
          ],
        },
        {
          title: "Software Engineer",
          dates: "Sept 2024 – Dec 2025",
          bullets: [
            "Re-engineered Product Listing Page onto an internal Layout Engine framework with half-card and M-Now quick-commerce integrations, cutting page latency by 30% and lifting RPU/conversion by 3%.",
            "Engineered a remote configurable system for changing app icons and splash screens during major sale events, driving a 5-8% increase in organic traffic share.",
            "Designed a Layout Engine-driven modal presentation system that dynamically triggers contextual half-cards based on user interactions while managing display logic via frequency capping, interval schedules, and A/B testing.",
          ],
        },
      ],
    },
    {
      company: "FlyFin AI",
      url: "https://flyfin.tax/",
      logo: "assets/companies/flyfin.png",
      roles: [
        {
          title: "Software Engineer",
          dates: "July 2023 – Sept 2024",
          bullets: [
            "Delivered multiple 0-to-1 tax features across the consumer app and internal CPA dashboard, owning frontend UI and backend low-level design with an extensible architecture for future product changes.",
            "Architected an automated OCR document upload pipeline integrating AWS Textract, driving a 4x increase in successful tax filing completions.",
            "Refactored the expense classification engine into a Celery and RabbitMQ distributed system, cutting processing time for 1K expenses by 87% (12 mins to 1.5 mins).",
            "Developed client-side PDF verification tools using Canvas API and Web Workers, accelerating ops document verification throughput by 40%.",
          ],
        },
      ],
    },
    {
      company: "Udaan",
      url: "https://udaan.com/",
      logo: "assets/companies/udaan.png",
      roles: [
        {
          title: "Software Engineering Intern",
          dates: "May 2022 – July 2022",
          bullets: [
            "Optimized Apache Solr indexing by restructuring schema fields, reducing search latency for high-volume catalog queries.",
            "Enhanced the CQRS synchronization pipeline with automated cleanup cron jobs, maintaining 99.9% data consistency between primary write databases and read stores.",
          ],
        },
      ],
    },
  ],

  projects: [
    {
      number: "01",
      title: "Product List Page",
      description:
        "Migrated Myntra's PLP Page to an internal server driven UI Framework called Layout Engine (LE).",
      tags: ["Myntra", "Mobile", "PLP"],
      link: "projects/PLP.md",
      linkLabel: "Watch the walkthrough",
    },
    {
      number: "02",
      title: "Category Browsing Page",
      description:
        "Layout Engine–driven category browsing revamp — responsive navigation and shorter paths to PDP on high-traffic journeys.",
      tags: ["Myntra", "Layout Engine", "Mobile"],
      link: "projects/Categories.md",
      linkLabel: "Watch the walkthrough",
    },
    {
      number: "03",
      title: "Dynamic App Icons & Splash",
      description:
        "Remote-configurable launcher icons and Lottie splash handoff for mega sales — without waiting on App Store or Play Store releases.",
      tags: ["Android", "iOS", "React Native"],
      link: "projects/AppIcon.md",
      linkLabel: "Read the case study",
    },
    {
      number: "04",
      title: "Cold Launch Optimization",
      description:
        "Parallelized Android startup and dual-cache Switch config to cut cold-boot work on the critical path for Myntra's app.",
      tags: ["Android", "Performance", "Startup"],
      link: "projects/ColdLaunchOptimisation.md",
      linkLabel: "Read the case study",
    },
    {
      number: "05",
      title: "Delta Bundle Patches",
      description:
        "OTA delta updates that shrank routine React Native bundle payloads from ~20MB to ~150KB with streaming native reconstruction and rollback safety.",
      tags: ["React Native", "OTA", "Android"],
      link: "projects/Bundle-Patch-Updates.md",
      linkLabel: "Read the case study",
    },
    {
      number: "06",
      title: "Document OCR Verification",
      description:
        "Client-side PDF verification for FlyFin CPAs — click a tax field, auto-scroll, and highlight Textract bounding boxes at 60 FPS.",
      tags: ["React", "OCR", "AWS Textract"],
      link: "projects/Document-OCR-Verification.md",
      linkLabel: "Read the case study",
    },
  ],
};
