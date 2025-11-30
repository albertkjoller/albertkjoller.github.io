// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "about",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-publications",
          title: "publications",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/publications/";
          },
        },{id: "nav-cv",
          title: "cv",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/cv/";
          },
        },{id: "dropdown-teaching",
              title: "teaching",
              description: "",
              section: "Dropdown",
              handler: () => {
                window.location.href = "/teaching/";
              },
            },{id: "dropdown-blog",
              title: "blog",
              description: "",
              section: "Dropdown",
              handler: () => {
                window.location.href = "/blog/";
              },
            },{id: "news-my-personal-webpage-is-online-looking-forward-to-share-my-academic-progress-here",
          title: 'My personal webpage is online - looking forward to share my academic progress...',
          description: "",
          section: "News",},{id: "news-i-defended-my-msc-thesis-about-riemannian-sharpness-aware-minimization-under-supervision-of-georgios-arvanitidis",
          title: 'I defended my MSc. Thesis about “Riemannian Sharpness-Aware Minimization” under supervision of Georgios...',
          description: "",
          section: "News",},{id: "news-new-preprint-w-georgios-monge-sam-robust-reparameterization-invariant-sharpness-aware-minimization-based-on-loss-geometry",
          title: 'New preprint w. Georgios: “Monge SAM: Robust Reparameterization-Invariant Sharpness-Aware Minimization Based on Loss...',
          description: "",
          section: "News",},{id: "news-i-joined-georgios-crew-as-a-research-assistant-thanks-for-welcoming-me-aboard",
          title: 'I joined Georgios’ crew as a research assistant. Thanks for welcoming me aboard!...',
          description: "",
          section: "News",},{id: "news-paper-accepted-how-redundant-is-the-transformer-stack-in-speech-representation-models-was-accepted-for-poster-presentation-at-icassp-2025-in-hyderabad",
          title: 'Paper accepted: “How Redundant Is the Transformer Stack in Speech Representation Models?” was...',
          description: "",
          section: "News",},{id: "news-the-danish-data-science-academy-ddsa-has-awarded-me-a-phd-fellowship-grant-for-my-project-on-geometric-approximate-bayesian-inference-this-is-truly-amazing-and-i-can-t-wait-to-get-started",
          title: 'The Danish Data Science Academy (DDSA) has awarded me a PhD Fellowship grant...',
          description: "",
          section: "News",},{id: "news-new-preprint-w-johanna-and-georgios-staying-on-the-manifold-geometry-aware-noise-injection",
          title: 'New preprint w. Johanna and Georgios: “Staying on the Manifold: Geometry-Aware Noise Injection”....',
          description: "",
          section: "News",},{id: "news-on-december-2nd-i-will-present-our-paper-how-redundant-is-the-transformer-stack-in-speech-representation-models-as-a-poster-at-the-ellis-unconference-in-copenhagen",
          title: 'On December 2nd I will present our paper “How Redundant Is the Transformer...',
          description: "",
          section: "News",},{id: "news-paper-accepted-staying-on-the-manifold-geometry-aware-noise-injection-was-accepted-for-presentation-at-the-northern-lights-deep-learning-conference-2026-in-tromsø",
          title: 'Paper accepted: “Staying on the Manifold: Geometry-Aware Noise Injection” was accepted for presentation...',
          description: "",
          section: "News",},{id: "news-paper-accepted-reducing-memorisation-in-generative-models-via-riemannian-bayesian-inference-was-accepted-for-presentation-at-the-workshop-on-principles-of-generative-modeling-at-eurips2025",
          title: 'Paper accepted: “Reducing Memorisation in Generative Models via Riemannian Bayesian Inference” was accepted...',
          description: "",
          section: "News",},{id: "projects-project-1",
          title: 'project 1',
          description: "with background image",
          section: "Projects",handler: () => {
              window.location.href = "/projects/1_project/";
            },},{id: "projects-project-2",
          title: 'project 2',
          description: "a project with a background image and giscus comments",
          section: "Projects",handler: () => {
              window.location.href = "/projects/2_project/";
            },},{id: "projects-project-3-with-very-long-name",
          title: 'project 3 with very long name',
          description: "a project that redirects to another website",
          section: "Projects",handler: () => {
              window.location.href = "/projects/3_project/";
            },},{id: "projects-project-4",
          title: 'project 4',
          description: "another without an image",
          section: "Projects",handler: () => {
              window.location.href = "/projects/4_project/";
            },},{id: "projects-project-5",
          title: 'project 5',
          description: "a project with a background image",
          section: "Projects",handler: () => {
              window.location.href = "/projects/5_project/";
            },},{id: "projects-project-6",
          title: 'project 6',
          description: "a project with no image",
          section: "Projects",handler: () => {
              window.location.href = "/projects/6_project/";
            },},{id: "projects-project-7",
          title: 'project 7',
          description: "with background image",
          section: "Projects",handler: () => {
              window.location.href = "/projects/7_project/";
            },},{id: "projects-project-8",
          title: 'project 8',
          description: "an other project with a background image and giscus comments",
          section: "Projects",handler: () => {
              window.location.href = "/projects/8_project/";
            },},{id: "projects-project-9",
          title: 'project 9',
          description: "another project with an image 🎉",
          section: "Projects",handler: () => {
              window.location.href = "/projects/9_project/";
            },},{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%61%6B%6A%6A%61@%64%74%75.%63%6F%6D", "_blank");
        },
      },{
        id: 'social-github',
        title: 'GitHub',
        section: 'Socials',
        handler: () => {
          window.open("https://github.com/albertkjoller", "_blank");
        },
      },{
        id: 'social-linkedin',
        title: 'LinkedIn',
        section: 'Socials',
        handler: () => {
          window.open("https://www.linkedin.com/in/albertkjoller", "_blank");
        },
      },{
        id: 'social-scholar',
        title: 'Google Scholar',
        section: 'Socials',
        handler: () => {
          window.open("https://scholar.google.com/citations?user=4034kssAAAAJ", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
