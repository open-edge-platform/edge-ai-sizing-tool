# Deployment

This section guides you through preparing and deploying your application on different target system. Follow these steps carefully to create a reliable deployment package and execute the application efficiently.

## 1. Setup Platform

Refer to the [Edge Developer Kit Reference Scripts](https://github.com/intel/edge-developer-kit-reference-scripts) for detailed instructions on preparing your system.

## 2. Install Dependencies

Run the provided `install.sh` script to install all necessary dependencies:

```bash
./install.sh
```

## 3. Setup Environment

Configure the environment details securely based on the `frontend/.env.example`

## 4. Generate Distribution Package

Navigate to the `frontend` directory and execute the following command to create a distribution package:

```bash
npm run dist
```

This command will generate an archive `.zip` file of the package in the `../dist` folder, such as `../dist/edge-ai-sizing-tool_<version>.zip`. The version number will depend on the current version specified in your package configuration.

## 5. Transfer and Extract Package

Transfer the generated `.zip` file to the target system where you intend to deploy the application. Once transferred, extract the contents of the `.zip` file.

## 6. Deploy and Run the Application

Follow the instructions for your operating system:

### For Linux:

Navigate to the extracted folder and execute the following commands to install and launch the application:

```bash
cd [extracted_folder]
./install.sh
./edge-ai-sizing-tool.sh
```

### For Windows:

Navigate to the extracted folder and double-click `install.cmd` to set up the application. Once installation is complete, double-click `edge-ai-sizing-tool.cmd` to start the application.

## 7. Optional: Uninstall the Application

If you need to uninstall the application, you can use the provided uninstall scripts:

### For Linux:

```bash
cd [extracted_folder]
./uninstall.sh
```

### For Windows:

Navigate to the extracted folder and double-click `uninstall.cmd` to remove the application.