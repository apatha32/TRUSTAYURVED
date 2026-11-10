/** Header navigation — labels and order exactly as the live site's menu. */
export type NavItem = { label: string; href?: string; children?: { label: string; href: string }[] };

export const NAV: NavItem[] = [
  { label: 'Home', href: '/' },
  {
    label: 'About Us', href: '/about/',
    children: [
      { label: 'About Us', href: '/about/' },
      { label: 'Vd. Sohan Pathak', href: '/vd-sohan-pathak/' },
      { label: 'Vd. Ashwini Pathak', href: '/vd-ashwini-pathak/' },
    ],
  },
  {
    label: 'Treatments',
    children: [
      { label: 'TADVIT COUNSELLING CENTER', href: '/tadvit-counselling-center/' },
      { label: 'General & Lifestyle Disorders', href: '/general-lifestyle-disorders/' },
      { label: 'Specialized Treatments', href: '/specialized-treatments/' },
      { label: 'Organ-Specific Disorders', href: '/organ-specific-disorders/' },
      { label: 'PANCHAKARMA & THERAPIES', href: '/panchakarma-therapies/' },
      { label: 'Mental Health', href: '/mental-health/' },
    ],
  },
  {
    label: 'Pages',
    children: [
      { label: 'Blog', href: '/blog/' },
      { label: 'Gallery', href: '/gallery/' },
      { label: 'Privacy Policy', href: '/privacy-policy/' },
      { label: 'Terms Condition', href: '/terms-condition/' },
      { label: 'Contact', href: '/contact/' },
      { label: 'Mental Health', href: '/mental-health/' },
    ],
  },
  { label: 'Contact', href: '/contact/' },
];

export function norm(p: string) { return p.endsWith('/') ? p : p + '/'; }
