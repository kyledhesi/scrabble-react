pipeline {
    agent any

    tools {
        nodejs 'Node 22'
    }

    environment {
        AWS_CREDENTIALS = 'aws-credentials'
        PATH = "/usr/local/bin:${env.PATH}"
        CONTAINER_NAME = "scrabble-webapp"
        AWS_ECR_URL = "949705860149.dkr.ecr.eu-west-2.amazonaws.com"
        AWS_REGION = "eu-west-2"
    }

    stages {
        stage('build') {
            steps {
                sh 'npm install'
                sh 'npm run build'
            }
        }

        stage('test') {
            steps {
                sh 'npm test'
            }
        }

        stage('build container') {
            steps {
                script {
                    dockerImage = docker.build("${CONTAINER_NAME}")

                    sh "docker tag ${CONTAINER_NAME} ${AWS_ECR_URL}/${CONTAINER_NAME}:${BUILD_NUMBER}"
                    sh "docker tag ${CONTAINER_NAME} ${AWS_ECR_URL}/${CONTAINER_NAME}:latest"
                }
            }
        }

        stage('deploy') {
             steps {
                script {
                    withCredentials([
                        [$class: 'AmazonWebServicesCredentialsBinding',
                        credentialsId: env.AWS_CREDENTIALS]
                    ]) {
                        sh '''
                            set -e
                            
                            aws ecr get-login-password --region eu-west-2 | docker login --username AWS --password-stdin ${AWS_ECR_URL}

                            aws ecr create-repository --repository-name ${CONTAINER_NAME} --region ${AWS_REGION}

                            docker push ${AWS_ECR_URL}/${CONTAINER_NAME}:${BUILD_NUMBER}
                            docker push ${AWS_ECR_URL}/${CONTAINER_NAME}:latest
                        '''
                    }
                }
            }
        }

        stage('Terraform Format Check') {
            steps {
                dir('terraform') {
                    sh 'terraform fmt -check -recursive'
                }
            }
        }

        stage('Terraform Init') {
            steps {
                dir('terraform') {
                    sh 'terraform init'
                }
            }
        }

        stage('Terraform Plan') {
            steps {
                withCredentials([
                    [$class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: env.AWS_CREDENTIALS]
                ]) {
                    dir('terraform') {
                        sh 'terraform plan -out=tfplan'
                    }

                }
            }
        }

        stage('Approval') {
            steps {
                input(
                    message: "You are about to run: terraform ${action}. Proceed?",
                    ok: 'Confirm'
                )
            }
        }

        //stage('Terraform Action') {
            //steps {
                //dir('terraform') {
                    //sh "terraform ${action} ${action == 'destroy' ? '--auto-approve' : ''}"
                //}   
            //}
        //}
    }

    post {
        always {
            cleanWs()
        }

        success {
            echo 'Terraform workflow completed successfully.'
        }

        failure {
            echo 'Pipeline failed. Check the console output above for details.'
        }
    }
}