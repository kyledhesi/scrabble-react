pipeline {
    agent any

    environment {
        AWS_CREDENTIALS = 'aws-credentials'
        GIT_REPO = "https://github.com/kyledhesi/rock-paper-scissors.git" 
    }
    
    stages {
        stage("checkout") {
            steps {
                git branch: 'main',
                url: GIT_REPO
            }
        }
        stage("build") {
            steps {
                sh 'npm install'
            }
        }

        stage("test") {
            steps {
                sh 'npm test'
            }
        }

        stage("deploy") {
            steps {
                
                sh '''
                aws ecr get-login-password --region eu-west-2 | docker login --username AWS --password-stdin 949705860149.dkr.ecr.eu-west-2.amazonaws.com/docker-hub
                docker build -t scrabble-webapp .
                docker tag scrabble-webapp:1.0.0 949705860149.dkr.ecr.eu-west-2.amazonaws.com/docker-hub:latest

                docker push 949705860149.dkr.ecr.eu-west-2.amazonaws.com/docker-hub:latest
                '''
            }

        }
    }
}