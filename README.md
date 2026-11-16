# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Inquiry Management setup

The admin Inquiry Management page requires the existing Supabase inquiry, staff-profile, and assignee-directory structures. Review and manually apply `backend/sql/inquiry_management_enhancements.sql`, then `backend/sql/inquiry_follow_up_management.sql`, in that order in the intended Supabase project. The second migration adds the narrowly scoped, authenticated follow-up update RPC used in place of direct inquiry UPDATE access. These migrations are not run by the application.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
