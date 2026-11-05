# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Freelance photographers and videographers (solo or with a small crew) and small production companies with a manager plus team members. Used half at the desk (planning shotlists, budgets, schedules, client records) and half on set from a phone (installed as a PWA on the home screen; "modo campo" for executing takes). Clients are a separate audience: they open a shared link on their own phone or computer to follow a production and a payment plan.

## Product Purpose
Shotlist plans and runs photo/video productions: shots with takes, an order of the day, team and schedule, budget and costs (including tax), client records (CRM) and installment payment plans. Success: the creator plans faster, executes from the phone without friction, and clients stay informed without back-and-forth messages.

## Positioning
One place that joins the shotlist, the money (budget, costs, tax, installments with e-mail reminders) and the client relationship, with real-time client follow-up links, a field mode for the shoot, and reference links (Instagram, YouTube, Vimeo) that become thumbnails and AI-suggested scripts.

## Operating Context
Multi-tenant SaaS: each user creates a workspace (company); a manager role sees finance and the accounts panel, regular members do not; productions can be shared with people outside the workspace. Interface language is Brazilian Portuguese. Hosted at shotlistapp.netlify.app (React + Vite, Supabase, Netlify via GitHub).

## Capabilities and Constraints
- Productions grouped by status (A FAZER, EM ANDAMENTO, CONCLUÍDO) with archiving.
- Public client views: production follow-up (`?client=`) and payment plan (`?payment=`), both real-time.
- Finance and payment plans are manager-only.
- PWA on iPhone/iPad (safe areas, Dynamic Island), field mode, PDF export with one shot per page.
- Constraints: existing data model and features must keep working; fonts limited to SF Pro / Helvetica Neue (no condensed); the Brazilian-Portuguese copy is binding.

## Brand Commitments
Name: Shotlist (signature "israellga.com"). Existing mark: viewfinder icon in amber on black; a black lightning-bolt asset (raio.png) was provided for a footer signature. Previously requested: minimalist, premium, monochrome login on mobile without yellow. The user now wants a liquid-glass interface direction.

## Evidence on Hand
Real usage by the owner with live productions (clients such as Camil, Minalba, Sky Hall). No customer testimonials or metrics exist; none should be invented.

## Product Principles
1. The shoot comes first: anything needed on set must be fast, legible one-handed and outdoors.
2. Money stays private by role; clients only see what was explicitly shared.
3. Show state at a glance (status, progress, next payment) before detail.
4. Client-facing pages must feel as considered as the owner's workspace.
