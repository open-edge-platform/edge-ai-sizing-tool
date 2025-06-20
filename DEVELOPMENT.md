# Development

This section provides instructions for setting up a development environment to modify and enhance the Edge AI Sizing Tool. Follow these steps to configure your system for development, allowing you to test changes and contribute to the project effectively.

## Frontend

### 1. Setup Platform

Refer to the [Edge Developer Kit Reference Scripts](https://github.com/intel/edge-developer-kit-reference-scripts) for detailed instructions on preparing your system.

### 2. Install Dependencies

Run the provided `install.sh` script to install all necessary dependencies:

```bash
./install.sh
```

### 3. Setup Frontend Environment

Configure the environment details securely based on the `frontend/.env.example`

### 4. Install dependency

Navigate to the `frontend` directory and install the necessary dependencies:

```bash
npm install
```

### 5. Start development server

Start the development server with the following command:

```bash
npm run dev
```

## Worker Services

### 1. Setup python virtual environment

From the `frontend` directory, run the following command to set up the worker services:

```bash
npm run setup:workers
```

### 2. Monitor the worker services

> **Notes:** This step is optional.

Use PM2 to monitor worker services:

```bash
# [optional] install dependency
npm install -g pm2

# list all processes
pm2 l

# stream all logs
pm2 logs

# stream specific process id
pm2 logs [id|name|namespace]
```