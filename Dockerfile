# Step 1: Use the official Node.js image (Alpine for a smaller image size)
FROM node:20.12.0-alpine

# Step 2: Set the working directory inside the container
WORKDIR /src/app

# Step 3: Copy package.json and package-lock.json (or yarn.lock) for dependency installation
COPY package*.json ./

# Step 4: Install the app's dependencies 
RUN npm install --omit=dev

# Step 5: Copy the rest of the application code into the container
COPY . .

# Step 6: Expose the port that the app will run on
EXPOSE 8000

# Step 7: Define the command to run the application
CMD ["npm", "start"]