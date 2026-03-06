// app/page.tsx
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  ChevronRight, FileText, Users, Building, Calendar, MapPin, Shield, 
  CheckCircle, Clock, Award, TrendingUp, Eye, Zap, BookOpen, Phone, 
  Mail, Briefcase, ArrowRight, Play, Star, BarChart3, Globe, 
  Sparkles, Target, HeartHandshake, Menu, X
} from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Modern Header with Glassmorphism */}
      <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white/70 backdrop-blur-xl border-b border-slate-200/50">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo with enhanced styling */}
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-600 rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity"></div>
                <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 flex items-center justify-center shadow-xl">
                  <Building className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-700 to-blue-600 bg-clip-text text-transparent tracking-tight">
                  DOAS
                </h1>
                <p className="text-xs font-medium text-slate-500 tracking-wider uppercase">FCT Administration</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {[
                { name: 'About', href: '#about' },
                { name: 'Services', href: '#services' },
                { name: 'Forms', href: '#forms' },
                { name: 'Contact', href: '#contact' }
              ].map((item) => (
                <Link 
                  key={item.name}
                  href={item.href} 
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50/50 rounded-full transition-all duration-200"
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Action Buttons */}
            <div className="hidden lg:flex items-center gap-3">
              <Link href="/admin">
                <Button 
                  variant="ghost" 
                  className="text-slate-600 hover:text-blue-600 hover:bg-blue-50 font-medium"
                >
                  Admin Portal
                </Button>
              </Link>
              <Link href="/submission-status">
                <Button 
                  className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-full px-6"
                >
                  Check Status
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button className="lg:hidden p-2 text-slate-600 hover:text-blue-600">
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section with Dynamic Background */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 bg-slate-50">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent"></div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-indigo-100/30 via-transparent to-transparent"></div>
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>
        </div>

        {/* Floating Elements */}
        <div className="absolute top-1/4 right-10 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 left-10 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

        <div className="container mx-auto px-4 lg:px-8 relative">
          <div className="max-w-5xl mx-auto">
            {/* Badge */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-sm font-medium text-slate-600">Official Government Portal</span>
                <Shield className="h-4 w-4 text-blue-600" />
              </div>
            </div>

            {/* Main Heading */}
            <div className="text-center mb-8">
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-slate-900 tracking-tight leading-[1.1] mb-6">
                Department of
                <span className="block mt-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent">
                  Outdoor Advertising
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed font-light">
                Transforming Abuja's visual landscape through innovative regulation, 
                seamless digital services, and world-class stakeholder engagement.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link href="#forms">
                <Button 
                  size="lg" 
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-xl hover:shadow-2xl hover:shadow-blue-500/25 transition-all duration-300 rounded-full px-8 py-6 text-lg font-semibold group"
                >
                  Submit Application
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="#services">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-2 border-slate-300 hover:border-blue-600 text-slate-700 hover:text-blue-600 bg-white/50 backdrop-blur-sm rounded-full px-8 py-6 text-lg font-semibold group"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Explore Services
                </Button>
              </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {[
                { value: "15K+", label: "Applications Processed", icon: FileText },
                { value: "2,500+", label: "Active Permits", icon: CheckCircle },
                { value: "98%", label: "Satisfaction Rate", icon: Star },
                { value: "24/7", label: "Digital Access", icon: Globe },
              ].map((stat, idx) => (
                <div 
                  key={idx}
                  className="group bg-white/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/60 hover:border-blue-300 hover:bg-white hover:shadow-xl transition-all duration-300"
                >
                  <stat.icon className="h-6 w-6 text-blue-600 mb-3 group-hover:scale-110 transition-transform" />
                  <div className="text-3xl font-bold text-slate-900 mb-1">{stat.value}</div>
                  <div className="text-sm text-slate-500 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Scroll</span>
          <div className="w-6 h-10 rounded-full border-2 border-slate-300 flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-slate-400 rounded-full animate-bounce"></div>
          </div>
        </div>
      </section>

      {/* About Section with Modern Layout */}
      <section id="about" className="py-24 relative">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-16">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm font-semibold mb-4">
                  <Sparkles className="h-4 w-4" />
                  About Us
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">
                  Leading the Future of
                  <span className="text-blue-600"> Urban Advertising</span>
                </h2>
                <p className="text-lg text-slate-600 leading-relaxed">
                  The Department of Outdoor Advertising and Signage serves as the premier regulatory 
                  authority for outdoor advertising across the Federal Capital Territory.
                </p>
              </div>
              <Link href="#" className="inline-flex items-center gap-2 text-blue-600 font-semibold hover:gap-3 transition-all">
                Learn more about us <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Content Grid */}
            <div className="grid lg:grid-cols-2 gap-8 mb-16">
              {/* Mission Card */}
              <div className="group relative overflow-hidden rounded-3xl bg-slate-900 text-white p-8 lg:p-10">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-6">
                    <Target className="h-7 w-7 text-blue-400" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Our Mission</h3>
                  <p className="text-slate-300 leading-relaxed mb-6">
                    To create a harmonious urban environment where commercial communication thrives 
                    within a framework of aesthetic excellence, public safety, and sustainable development.
                  </p>
                  <blockquote className="border-l-4 border-blue-500 pl-4 italic text-slate-400">
                    "Transforming Abuja into a world-class capital through innovative regulation 
                    and exceptional stakeholder engagement."
                  </blockquote>
                </div>
              </div>

              {/* Vision Card */}
              <div className="group relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-8 lg:p-10 hover:shadow-2xl transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative">
                  <div className="h-14 w-14 rounded-2xl bg-blue-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Eye className="h-7 w-7 text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-4">Our Vision</h3>
                  <p className="text-slate-600 leading-relaxed mb-6">
                    Establishing Abuja as the benchmark for outdoor advertising regulation in Africa, 
                    combining technological innovation with regulatory excellence.
                  </p>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      Innovation First
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      Excellence Always
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Cards */}
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: Shield,
                  title: "Regulatory Excellence",
                  desc: "Comprehensive frameworks balancing commercial needs with urban aesthetics",
                  color: "from-blue-500 to-blue-600",
                  bgColor: "bg-blue-50"
                },
                {
                  icon: CheckCircle,
                  title: "Efficient Approvals",
                  desc: "Streamlined processes ensuring timely reviews without compromising quality",
                  color: "from-emerald-500 to-emerald-600",
                  bgColor: "bg-emerald-50"
                },
                {
                  icon: BarChart3,
                  title: "Data-Driven",
                  desc: "Advanced analytics and monitoring for informed decision making",
                  color: "from-violet-500 to-violet-600",
                  bgColor: "bg-violet-50"
                }
              ].map((feature, idx) => (
                <Card 
                  key={idx} 
                  className="group border-0 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
                >
                  <div className={`h-2 bg-gradient-to-r ${feature.color}`}></div>
                  <CardHeader>
                    <div className={`h-14 w-14 rounded-2xl ${feature.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <feature.icon className="h-7 w-7 text-slate-700" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services Section with Hover Effects */}
      <section id="services" className="py-24 bg-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>

        <div className="container mx-auto px-4 lg:px-8 relative">
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold mb-4">
                <Zap className="h-4 w-4" />
                Our Services
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">
                Comprehensive Solutions for
                <span className="text-indigo-600"> Every Need</span>
              </h2>
              <p className="text-lg text-slate-600">
                From application to installation, we provide end-to-end services designed to 
                streamline your outdoor advertising journey.
              </p>
            </div>

            {/* Services Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: FileText,
                  title: "Signage Approval",
                  desc: "Comprehensive review and approval for all outdoor signage types including billboards, LED displays, and storefront signs.",
                  features: ["Fast-track processing", "5-7 day turnaround", "Digital certificates"],
                  color: "blue",
                  gradient: "from-blue-500 to-blue-600"
                },
                {
                  icon: Users,
                  title: "Technical Consultation",
                  desc: "Expert guidance on signage design, specifications, materials, and installation best practices.",
                  features: ["Pre-application advice", "Site assessments", "Vendor recommendations"],
                  color: "emerald",
                  gradient: "from-emerald-500 to-emerald-600"
                },
                {
                  icon: Eye,
                  title: "Compliance Monitoring",
                  desc: "Systematic inspections ensuring all installations meet approved specifications and safety standards.",
                  features: ["Regular inspections", "Safety audits", "Remediation support"],
                  color: "violet",
                  gradient: "from-violet-500 to-violet-600"
                },
                {
                  icon: Clock,
                  title: "Permit Renewal",
                  desc: "Streamlined renewal process with automated reminders and expedited processing.",
                  features: ["Auto-reminders", "Online renewal", "Multi-year options"],
                  color: "orange",
                  gradient: "from-orange-500 to-orange-600"
                },
                {
                  icon: Briefcase,
                  title: "Practitioner Registration",
                  desc: "Professional certification program for advertising practitioners with enhanced privileges.",
                  features: ["Certification", "Bulk submissions", "Priority support"],
                  color: "indigo",
                  gradient: "from-indigo-500 to-indigo-600"
                },
                {
                  icon: BookOpen,
                  title: "Public Education",
                  desc: "Workshops, resources, and training programs for regulation compliance.",
                  features: ["Quarterly workshops", "Guideline downloads", "Video tutorials"],
                  color: "teal",
                  gradient: "from-teal-500 to-teal-600"
                }
              ].map((service, idx) => (
                <Card 
                  key={idx} 
                  className="group relative border border-slate-200 hover:border-transparent transition-all duration-300 hover:shadow-2xl overflow-hidden"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${service.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
                  <CardHeader>
                    <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${service.gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                      <service.icon className="h-7 w-7 text-white" />
                    </div>
                    <CardTitle className="text-xl group-hover:text-slate-900">{service.title}</CardTitle>
                    <CardDescription className="text-base leading-relaxed">{service.desc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {service.features.map((feature, fidx) => (
                        <li key={fidx} className="flex items-center gap-2 text-sm text-slate-600">
                          <CheckCircle className={`h-4 w-4 text-${service.color}-500 flex-shrink-0`} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button 
                      variant="ghost" 
                      className={`text-${service.color}-600 hover:text-${service.color}-700 hover:bg-${service.color}-50 p-0 h-auto font-semibold group/btn`}
                    >
                      Learn more 
                      <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Application Forms Section */}
      <section id="forms" className="py-24 bg-slate-50 relative">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm font-semibold mb-4">
                <FileText className="h-4 w-4" />
                Get Started
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">
                Choose Your
                <span className="text-blue-600"> Application Type</span>
              </h2>
              <p className="text-lg text-slate-600">
                Select the most appropriate pathway for your needs. Our streamlined process 
                ensures efficient review and approval.
              </p>
            </div>

            {/* Application Cards */}
            <div className="grid md:grid-cols-3 gap-8 mb-16">
              {/* First Party */}
              <div className="group relative bg-white rounded-3xl p-8 border border-slate-200 hover:border-blue-300 hover:shadow-2xl transition-all duration-300">
                <div className="absolute -top-4 left-8">
                  <span className="px-4 py-1 bg-blue-600 text-white text-sm font-bold rounded-full shadow-lg">
                    Popular
                  </span>
                </div>
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 transition-transform">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">First-Party</h3>
                <p className="text-slate-500 mb-6">Direct application by property owner</p>
                <p className="text-slate-600 mb-6 leading-relaxed">
                  For property owners installing signage on their own property. Direct review by the Director's office.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    "Direct-to-Director review",
                    "5-7 business day processing",
                    "No practitioner fees",
                    "Priority handling"
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm text-slate-600">
                      <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="h-3 w-3 text-blue-600" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/submissions/first-party" className="block">
                  <Button className="w-full bg-slate-900 hover:bg-blue-600 text-white rounded-xl py-6 font-semibold transition-colors duration-300">
                    Apply Now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {/* Third Party */}
              <div className="group relative bg-white rounded-3xl p-8 border border-slate-200 hover:border-emerald-300 hover:shadow-2xl transition-all duration-300">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 transition-transform">
                  <Briefcase className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Third-Party</h3>
                <p className="text-slate-500 mb-6">Via registered practitioner</p>
                <p className="text-slate-600 mb-6 leading-relaxed">
                  For applications by certified practitioners on behalf of clients. Requires valid registration.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    "Professional submission",
                    "Bulk upload options",
                    "Enhanced compliance support",
                    "Dedicated account manager"
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm text-slate-600">
                      <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="h-3 w-3 text-emerald-600" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/submissions/third-party" className="block">
                  <Button className="w-full bg-white border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-900 hover:text-emerald-700 rounded-xl py-6 font-semibold transition-all duration-300">
                    Apply as Practitioner
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {/* Meeting Request */}
              <div className="group relative bg-white rounded-3xl p-8 border border-slate-200 hover:border-violet-300 hover:shadow-2xl transition-all duration-300">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 transition-transform">
                  <Calendar className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Request Meeting</h3>
                <p className="text-slate-500 mb-6">Schedule consultation</p>
                <p className="text-slate-600 mb-6 leading-relaxed">
                  Request a meeting with the Director for complex projects or policy inquiries.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    "One-on-one consultation",
                    "Flexible scheduling",
                    "Expert policy guidance",
                    "Complex project review"
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm text-slate-600">
                      <div className="h-5 w-5 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="h-3 w-3 text-violet-600" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/submissions/meeting-request" className="block">
                  <Button className="w-full bg-white border-2 border-slate-200 hover:border-violet-500 hover:bg-violet-50 text-slate-900 hover:text-violet-700 rounded-xl py-6 font-semibold transition-all duration-300">
                    Schedule Meeting
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Process Timeline */}
            <div className="bg-white rounded-3xl p-8 lg:p-12 shadow-xl border border-slate-200">
              <h3 className="text-2xl font-bold text-slate-900 mb-10 text-center">Application Process</h3>
              <div className="grid md:grid-cols-4 gap-8 relative">
                {/* Connection Line */}
                <div className="hidden md:block absolute top-12 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200 mx-12"></div>
                
                {[
                  {
                    step: "01",
                    icon: FileText,
                    title: "Submit",
                    desc: "Complete application with required documents"
                  },
                  {
                    step: "02",
                    icon: Eye,
                    title: "Review",
                    desc: "Initial assessment within 2 business days"
                  },
                  {
                    step: "03",
                    icon: CheckCircle,
                    title: "Approval",
                    desc: "Director reviews compliant applications"
                  },
                  {
                    step: "04",
                    icon: Award,
                    title: "Permit",
                    desc: "Receive digital permit and begin installation"
                  }
                ].map((item, idx) => (
                  <div key={idx} className="relative text-center">
                    <div className="relative z-10 h-24 w-24 mx-auto mb-4 bg-white rounded-full border-4 border-blue-100 flex items-center justify-center shadow-lg group-hover:border-blue-300 transition-colors">
                      <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <item.icon className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <div className="text-sm font-bold text-blue-600 mb-2">{item.step}</div>
                    <h4 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h4>
                    <p className="text-sm text-slate-600">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left Content */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-sm font-semibold mb-6">
                  <HeartHandshake className="h-4 w-4" />
                  Why DOAS
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-6">
                  Experience the <span className="text-blue-600">Difference</span>
                </h2>
                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                  We're committed to transforming how outdoor advertising is regulated in Abuja, 
                  combining cutting-edge technology with exceptional customer service.
                </p>

                <div className="space-y-6">
                  {[
                    {
                      icon: Zap,
                      title: "Fast Processing",
                      desc: "5-7 day average approval with expedited options",
                      color: "text-amber-500",
                      bgColor: "bg-amber-50"
                    },
                    {
                      icon: Shield,
                      title: "Full Transparency",
                      desc: "Real-time tracking and automated updates at every stage",
                      color: "text-blue-500",
                      bgColor: "bg-blue-50"
                    },
                    {
                      icon: Users,
                      title: "Expert Support",
                      desc: "Dedicated consultants guiding you through every step",
                      color: "text-emerald-500",
                      bgColor: "bg-emerald-50"
                    }
                  ].map((feature, idx) => (
                    <div key={idx} className="flex gap-4 group">
                      <div className={`h-12 w-12 rounded-xl ${feature.bgColor} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                        <feature.icon className={`h-6 w-6 ${feature.color}`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1">{feature.title}</h3>
                        <p className="text-slate-600">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Visual */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl transform rotate-3"></div>
                <div className="relative bg-slate-900 rounded-3xl p-8 text-white overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -ml-32 -mb-32"></div>
                  
                  <div className="relative">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                        <BarChart3 className="h-8 w-8 text-blue-400" />
                      </div>
                      <div>
                        <div className="text-sm text-slate-400 mb-1">Performance Metrics</div>
                        <div className="text-2xl font-bold">Q1 2024 Report</div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {[
                        { label: "Applications Approved", value: 98, color: "bg-blue-500" },
                        { label: "On-Time Delivery", value: 96, color: "bg-emerald-500" },
                        { label: "Customer Satisfaction", value: 99, color: "bg-violet-500" }
                      ].map((metric, idx) => (
                        <div key={idx}>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-300">{metric.label}</span>
                            <span className="font-bold">{metric.value}%</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${metric.color} rounded-full transition-all duration-1000`}
                              style={{ width: `${metric.value}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {[1,2,3,4].map((_, i) => (
                          <div key={i} className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-slate-900"></div>
                        ))}
                      </div>
                      <div className="text-sm text-slate-400">
                        <span className="text-white font-bold">2,500+</span> Active Clients
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-slate-900 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-slate-900 to-slate-900"></div>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
        
        <div className="container mx-auto px-4 lg:px-8 relative">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm font-semibold mb-6 border border-blue-500/20">
                <Phone className="h-4 w-4" />
                Get in Touch
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
                We're Here to <span className="text-blue-400">Help</span>
              </h2>
              <p className="text-lg text-slate-400">
                Have questions or need assistance? Our dedicated team is ready to support you 
                through every step of the process.
              </p>
            </div>

            {/* Contact Grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {[
                {
                  icon: MapPin,
                  title: "Visit Us",
                  lines: [
                    "Department of Outdoor Advertising",
                    "Federal Capital Territory Admin",
                    "Area 11, Garki District, Abuja"
                  ],
                  color: "blue"
                },
                {
                  icon: Phone,
                  title: "Call Us",
                  lines: [
                    "+234 (0) 9 461 2345",
                    "+234 (0) 9 461 2346",
                    "Mon-Fri, 8am - 4pm"
                  ],
                  color: "emerald"
                },
                {
                  icon: Mail,
                  title: "Email Us",
                  lines: [
                    "info@doas.gov.ng",
                    "support@doas.gov.ng",
                    "Response within 24hrs"
                  ],
                  color: "violet"
                }
              ].map((contact, idx) => (
                <div 
                  key={idx}
                  className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                >
                  <div className={`h-12 w-12 rounded-xl bg-${contact.color}-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <contact.icon className={`h-6 w-6 text-${contact.color}-400`} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{contact.title}</h3>
                  <div className="space-y-1">
                    {contact.lines.map((line, lidx) => (
                      <p key={lidx} className={`text-sm ${lidx === 0 ? 'text-slate-200' : 'text-slate-400'}`}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-3xl p-8 border border-blue-500/20">
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { icon: Phone, label: "Emergency Hotline", value: "+234 9 461 2345", href: "tel:+23494612345" },
                  { icon: Mail, label: "Email Support", value: "help@doas.gov.ng", href: "mailto:help@doas.gov.ng" },
                  { icon: FileText, label: "Track Application", value: "Check Status", href: "/status" }
                ].map((action, idx) => (
                  <Link 
                    key={idx}
                    href={action.href}
                    className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all group"
                  >
                    <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <action.icon className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-sm text-slate-400 mb-1">{action.label}</div>
                      <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                        {action.value}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modern Footer */}
      <footer className="bg-slate-950 text-slate-400 py-16 border-t border-slate-900">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
              {/* Brand */}
              <div className="lg:col-span-2">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                    <Building className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">DOAS</h3>
                    <p className="text-xs text-slate-500">FCT Administration</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed mb-6 max-w-sm">
                  Regulating outdoor advertising excellence across Abuja, ensuring a harmonious 
                  balance between commercial communication and urban aesthetics.
                </p>
                <div className="flex gap-4">
                  {['Twitter', 'LinkedIn', 'Facebook'].map((social) => (
                    <div key={social} className="h-10 w-10 rounded-full bg-slate-900 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors cursor-pointer">
                      <Globe className="h-4 w-4" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Links */}
              {[
                {
                  title: "Quick Links",
                  links: ["About Us", "Services", "Applications", "Check Status"]
                },
                {
                  title: "Resources",
                  links: ["Guidelines", "FAQ", "Downloads", "Practitioners"]
                },
                {
                  title: "Legal",
                  links: ["Privacy Policy", "Terms of Service", "Regulations", "Contact"]
                }
              ].map((column, idx) => (
                <div key={idx}>
                  <h4 className="font-semibold text-white mb-4">{column.title}</h4>
                  <ul className="space-y-3 text-sm">
                    {column.links.map((link) => (
                      <li key={link}>
                        <Link href="#" className="hover:text-blue-400 transition-colors">
                          {link}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Bottom Bar */}
            <div className="pt-8 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-sm">
                © {new Date().getFullYear()} Department of Outdoor Advertising and Signage. 
                All rights reserved.
              </p>
              <p className="text-sm text-slate-500">
                Federal Capital Territory Administration, Abuja, Nigeria
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}