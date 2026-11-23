FROM docker.n8n.io/n8nio/n8n:latest

ENV NODE_PATH=/usr/local/lib/node_modules/n8n/node_modules

USER root
# Create directory structure for custom extension
RUN mkdir -p /home/node/.n8n/custom/node_modules/n8n-nodes-fox-schema-multi-enpoints/dist

# Copy package definition and built distribution
COPY package.json /home/node/.n8n/custom/node_modules/n8n-nodes-fox-schema-multi-enpoints/
COPY dist /home/node/.n8n/custom/node_modules/n8n-nodes-fox-schema-multi-enpoints/dist

# Ensure proper permissions for node user
RUN chown -R node:node /home/node/.n8n

USER node
