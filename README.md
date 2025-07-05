# How to Run the Tutor Scrapper

This guide will help you run the Tutor Scrapper application on your computer. This program collects information and saves it into a file called `tutor_data.csv`.

## Step 1: Install Node.js

Node.js is a program that allows your computer to run this application.

1.  Go to the official Node.js website: [https://nodejs.org/en/download/](https://nodejs.org/en/download/)
2.  Download the **LTS** (Long Term Support) version for your operating system (Windows, macOS, or Linux). This is the recommended version for most users.
3.  Follow the installation instructions. You can usually just click "Next" through the installer.

## Step 2: Get the Application Ready

Now you need to prepare the application to run.

1.  Open your computer's **Terminal** (on macOS/Linux) or **Command Prompt** / **PowerShell** (on Windows). You can usually find this by searching for "Terminal", "Command Prompt", or "PowerShell" in your computer's search bar.
2.  Navigate to the folder where you have saved the Tutor Scrapper application. For example, if you saved it in a folder called `TutorScrapper` on your Desktop, you would type:
    ```bash
    cd Desktop/TutorScrapper
    ```
    (If you saved it elsewhere, replace `Desktop/TutorScrapper` with the correct path to your folder.)
3.  Once you are in the `TutorScrapper` folder, type the following command and press Enter:
    ```bash
    npm install
    ```
    This command will download all the necessary parts for the application to work. It might take a few minutes.

## Step 3: Run the Application

Finally, you can run the application!

1.  In the same **Terminal** / **Command Prompt** / **PowerShell** window (still in the `TutorScrapper` folder), type the following command and press Enter:
    ```bash
    node index.js
    ```
2.  The application will start running. You might see some messages in the terminal.
3.  Once the application finishes, it will create a file named `tutor_data.csv` in the same folder. This file contains the collected information. You can open this file with spreadsheet programs like Microsoft Excel, Google Sheets, or LibreOffice Calc.

If you encounter any issues, please contact the person who provided you with this application for assistance.