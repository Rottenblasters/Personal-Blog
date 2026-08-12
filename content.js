/*
 * EDIT THIS FILE TO UPDATE YOUR PORTFOLIO.
 *
 * Add projects to `projects` and Markdown articles to `posts`.
 * Place resume and article files in this folder, then update their paths below.
 */
window.PORTFOLIO_CONTENT = {
  profile: {
    name: "Anshul Singh",
    role: "Software Engineer & Product Builder",
    location: "New York, NY",
    availability: "Open to meaningful collaborations",
    intro:
      "I build reliable mobile experiences and explore how artificial intelligence can solve practical engineering problems.",
    about:
      "Replace this paragraph with your story—what you work on, the problems you enjoy solving, and what makes your perspective unique. Keep it personal, specific, and concise.",
    email: "as22791@nyu.edu",
    resume: "resume.pdf",
    social: {
      github: "https://github.com/",
      linkedin: "https://www.linkedin.com/",
    },
    skills: [
      "Mobile Engineering",
      "React Native",
      "Kotlin Multiplatform",
      "iOS & Android",
      "Performance",
      "Applied AI",
    ],
  },

  projects: [
    {
      number: "01",
      title: "Armitage",
      description:
        "A cross-platform mobile performance system that measures real-user FPS, CPU, memory, and launch vitals with intelligent anomaly detection.",
      tags: ["Kotlin Multiplatform", "React Native", "Performance", ""],
      link: "#blog",
      linkLabel: "Read the case study",
    },
    {
      number: "02",
      title: "Your Next Project",
      description:
        "Add a short, outcome-focused explanation of what you built, why it mattered, and the impact it created.",
      tags: ["Technology", "Problem Solving"],
      link: "#contact",
      linkLabel: "Add project link",
    },
    {
      number: "03",
      title: "Another Project",
      description:
        "Use this space for an AI experiment, an open-source contribution, or a product you are proud to have shipped.",
      tags: ["AI", "Engineering"],
      link: "#contact",
      linkLabel: "Add project link",
    },
  ],

  posts: [
    {
      title:
        "How We Built a Doctor for Myntra's App — Measuring Every Heartbeat of Performance",
      excerpt:
        "Inside Armitage, a system that listens to a mobile app's pulse in real time and turns raw performance vitals into an actionable diagnosis.",
      date: "2026-07-17",
      category: "Mobile Engineering",
      readTime: "12 min read",
      file: "armitage-mobile-vitals-blog.md",
      featured: true,
    },
  ],
};
