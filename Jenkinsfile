pipeline {
    agent any

    tools {
        nodejs 'Node 22'
    }

    environment {
        AWS_CREDENTIALS = 'aws-credentials'

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
                    dockerImage.tag("949705860149.dkr.ecr.eu-west-2.amazonaws.com/docker-hub:${BUILD_NUMBER}"
)
                }
            }
        }

        stage("deploy") {
            steps {
                script {
                    docker.withRegistry('https://949705860149.dkr.ecr.eu-west-2.amazonaws.com', 'ecr:eu-west-2:aws-credentials') {
                        dockerImage.push("${env.BUILD_NUMBER}")
                        dockerImage.push("latest")
                    }
                }    
            }

        }
    }
}