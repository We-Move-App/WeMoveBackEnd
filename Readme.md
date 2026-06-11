# Project Setup Guide

This project is built using **Node.js**, **Express.js**, and **MongoDB**.

## Prerequisites

Ensure the following software is installed:

- Node.js **v20.x** (recommended)
- npm (comes with Node.js)
- MongoDB (Local or Atlas)

Verify Node.js installation:

```bash
node -v
```

Expected output:

```bash
v20.x.x
```

## Setup Instructions

### 1. Extract the Project

Extract the provided project ZIP file to your preferred location.

Example:

```text
C:\Projects\wemoveall
```

or

```text
/home/user/projects/wemoveall
```

### 2. Open the Project

Navigate to the project directory:

```bash
cd wemoveall
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

cp .env.example .env

### 5. Start MongoDB

Use your MongoDB Atlas connection string in `MONGODB_URI` (If using Atlas).

### 6. Run the Application

Development Mode:

```bash
npm run dev
```

Production Mode:

```bash
npm start
```

### 7. Verify the Server

http://localhost:8000

## Recommended Versions

| Software | Version      |
| -------- | ------------ |
| Node.js  | 20.x         |
| npm      | 10.x         |
| MongoDB  | 7.x or later |
