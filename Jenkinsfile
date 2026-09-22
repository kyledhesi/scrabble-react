pipeline {
    agent any

    tools {
        nodejs 'Node 22'
    }

    environment {
        AWS_CREDENTIALS = 'aws-credentials'
        //PATH = "/usr/local/bin:/opt/homebrew/bin:${env.PATH}"
        PATH = "/usr/local/bin:${env.PATH}"
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
                    dockerImage = docker.build('scrabble-webapp')

                    sh "docker tag scrabble-webapp 949705860149.dkr.ecr.eu-west-2.amazonaws.com/scrabble-webapp:${BUILD_NUMBER}"
                    sh "docker tag scrabble-webapp 949705860149.dkr.ecr.eu-west-2.amazonaws.com/scrabble-webapp:latest"
                }
            }
        }
        
        stage('Check Docker') {
    steps {
        sh '''
            echo "PATH=$PATH"
            echo "Docker location:"
            which docker
            echo "Docker version:"
            docker --version
            echo "Docker executable:"
            ls -l /usr/local/bin/docker
        '''
    }
}
        

        stage('deploy') {
            steps {
                script {
                    docker.withRegistry(
                        "https://949705860149.dkr.ecr.eu-west-2.amazonaws.com",
                        "ecr:eu-west-2:${AWS_CREDENTIALS}"
                    ) {
                        dockerImage.push("${env.BUILD_NUMBER}")
                        dockerImage.push('latest')
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
                dir('terraform') {
                    sh 'terraform plan -out=tfplan'
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

        stage('Terraform Action') {
            steps {
                dir('terraform') {
                    sh "terraform ${action} ${action == 'destroy' ? '--auto-approve' : ''}"
                }   
            }
        }
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