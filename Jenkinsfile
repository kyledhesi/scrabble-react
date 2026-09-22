pipeline {
    agent any

    tools {
        nodejs 'Node 22'
    }

    environment {
        AWS_CREDENTIALS = 'aws-credentials'
        PATH = "/usr/local/bin:/opt/homebrew/bin:${env.PATH}"

    }
    
    stages {
        stage("build") {
            steps {
                sh 'npm install'
                sh 'npm run build'
            }
        }

        stage("test") {
            steps {
                sh 'npm test'
            }
        }

        stage("build container") {
            steps {
                script {
                    dockerImage = docker.build('scrabble-webapp')
                    sh "docker tag scrabble-webapp 949705860149.dkr.ecr.eu-west-2.amazonaws.com/scrabble-webapp:${BUILD_NUMBER}"
                    sh "docker tag scrabble-webapp 949705860149.dkr.ecr.eu-west-2.amazonaws.com/scrabble-webapp:latest"
                }
            }
        }

        stage("deploy") {
            steps {
                script {
                    docker.withRegistry("https://949705860149.dkr.ecr.eu-west-2.amazonaws.com", "ecr:eu-west-2:${AWS_CREDENTIALS}") {
                        dockerImage.push("${env.BUILD_NUMBER}")
                        dockerImage.push("latest")
                    }
                }
            }
        }
    }
}