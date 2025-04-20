from flask import Flask, request, send_from_directory, jsonify,redirect,render_template,send_file,make_response,url_for
from werkzeug.utils import secure_filename
import logging
# log = logging.getLogger('pydrop')
import shutil
import time
import albumentations as A 
# albumentations takes too much time to import
import os
os.environ["ALBUMENTATIONS_IGNORE_VERSION"] = "1"
import uuid
import base64
import json
import fnmatch
import threading
import cv2
import pandas as pd
from PIL import Image, ImageFilter
import numpy as np
from augmentation_functions import apply_gaussian_blur
from augmentation_functions import apply_rotate
from augmentation_functions import apply_counter_clockwise
from augmentation_functions import apply_upside_down
from augmentation_functions import apply_clockwise
from augmentation_functions import crop
os.environ["ALBUMENTATIONS_IGNORE_VERSION"] = "1"
import random
from werkzeug import Request as r
r.max_form_parts = 10000
log = logging.getLogger('werkzeug')
# log.setLevel(logging.ERROR)
static_folder_path = os.path.join(os.getcwd(),'static')
application = app = Flask(__name__, static_folder=static_folder_path,template_folder=os.path.join(os.getcwd(),'templates'))
application.config['UPLOAD_FOLDER']=os.path.join(static_folder_path,'upload_folder')

print("current dir:",os.getcwd())  # Prints the current working directory
application.config["TEMPLATES_AUTO_RELOAD"] = True
image_pathhs = {}
upload_folder_path = os.path.join(static_folder_path,'upload_folder') # putting uploaded datasets and interactive images in seperate folders
interactive_images_folder_path = os.path.join(static_folder_path,"interactive_images_uploads")

valid_image_extensions = ('.png', '.jpg', '.jpeg', '.tiff', '.bmp')
#the keys for this dict are folder ids, and the values are the sample image's extension from the corresponding folder
dict_with_interactive_image_paths = {} #dict with image extensions that will be used for interacitve sliders
#if the value for a key (a folder id) is 'none', that means that the folder is invalid and has no images
#website


class_info_dict = {}
#class_info_dict contains folder ids as keys, and the class info dictionary for the given folder as a value.
#(ONLY FOR FOLDER LABELS) each class info dictionary contains paths to classes as keys, and the classes images as values. (ex. class_info_dict[folder_id]['path_to_dog_class'] ---> list of paths to dog images)
#(ONLY FOR CSV LABELS) each class info dictionary also contains a dictionary of csv labeled images (ex. class_info_dict[folder_id]['csv_labeled_images']---> dict of image paths as keys, and classes as values)
# each class info dictionary also contains a list of unlabeled images from both folders and csv (ex. class_info_dict[folder_id]['unlabeled_images'] ---> list of paths to unlabeled images)

# #get an image from each class in the dataset, and return the paths to those images to a function that will generate interactive images for each class
# def getAllClassImages(id):
#     class_image_paths = [] #list of images in the dataset
#     classes = [] #list of classes in the dataset
#     class_counts = [] #list of the number of images in each class
#     for Class in tuple(class_info_dict[id].keys()):
#         classes.append(Class)
#         class_counts.append(len(class_info_dict[id][Class]))
#         class_image_paths.append(class_info_dict[id][Class][0])
# def getAllClassImageCounts(id):
#     class_image_counts = {} #a dictionary that contains classes as keys, and the number of images in each class as values
#     for Class in tuple(class_info_dict[id].keys()):
#         class_image_counts[Class] = len(class_info_dict[id][Class])


def getAllLabeledImagePaths(folder_id): # returns a list of image paths and their corresponding classes (ex. [[imgPath1,"dogClass"],[imgPath2,"catClass"]])
    img_path_list = []
    for key in class_info_dict[folder_id].keys():
        if key != 'csv_labeled_images' and key!='unlabeled_images':
            className = key #To be used later
            for imgPath in class_info_dict[folder_id][className]:
                img_path_list.append([imgPath,className]) #appending the path to the image and its corresponding class
        elif key =='csv_labeled_images':
            for imgPath in class_info_dict[folder_id]['csv_labeled_images'].keys():
                className = class_info_dict[folder_id]['csv_labeled_images'][imgPath]
                img_path_list.append([imgPath,className])
    return img_path_list 

def delete_dir(path):
    shutil.rmtree(path,ignore_errors=True)

def find_classes(csv_file, filenames):
    # Read the CSV file into a DataFrame
    df = pd.read_csv(csv_file)
    path_to_directory = '/'.join(csv_file.split('/')[:-1])
    # ##print('path to direc:',path_to_directory)
    # Extract the class names from the DataFrame
    class_names = df.columns[1:].tolist()  # Assuming first column is 'filename'

    result = {}
    unlabeled = []
    for filename in filenames:
        # Find the row corresponding to the given filename
        file_row = df[df['filename'] == filename]
        if len(file_row) == 0:
            ##print("Filename", filename, "not found.")
            result[filename] = []
            unlabeled.append(filename)
            continue

        # Extract the classes associated with the filename
        classes = file_row.iloc[0, 1:].tolist()

        # Map class indices to class names
        classes_names_associated = [class_names[i] for i, c in enumerate(classes) if c == 1]

        result[os.path.join(path_to_directory,filename)] = classes_names_associated
    unlabeled = [os.path.join(path_to_directory,filename) for filename in unlabeled]
    return [result,unlabeled]

def find_image_directories(root_dir):
    # Define common image file extensions
    image_extensions = ('*.jpg', '*.jpeg', '*.png', '*.gif', '*.bmp', '*.tiff')
    
    # List to store directories containing images
    image_dirs = []

    # Walk through directory tree
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Check if any file in the directory matches the image extensions
        for ext in image_extensions:
            if any(fnmatch.fnmatch(file, ext) for file in filenames):
                image_dirs.append(dirpath)
                break
    
    return image_dirs

def unzip(path_to_zip_file):
    zip_filename = path_to_zip_file.split('/')[-1]
    # ##print("zip filename:",zip_filename)
    directory_to_extract_to = os.path.join(upload_folder_path,zip_filename[:-4])
    # ##print("dir to extrac to:",directory_to_extract_to)
    os.mkdir(directory_to_extract_to)
    shutil.unpack_archive(path_to_zip_file,directory_to_extract_to,'zip') #unpacking zip file
    rand_filename = random_filename()

    os.rename(path_to_zip_file,os.path.join(upload_folder_path,rand_filename)) #renaming zip file to random name before deleting so the actual folder containing the images doesn't get deleted

    thread1 = threading.Thread(target=delete_zip_file,args=(rand_filename,)) 
    thread1.start()#starting thread to delete initially uploaded zip file

    return directory_to_extract_to

def find_sum_of_strings(list):
    sum=''
    for i in list:
        sum+=i
    return sum



@application.route('/download/<id>/<uploadOption>', methods=['GET']) #<id> is a dynamic parameter, meaning it's not a fixed value and is the text after '/download'
def download(id,uploadOption):
    for dir in os.listdir(upload_folder_path):
        if id in dir and dir[-4:]=='.zip':
            ##print(id,'in',dir)
            download_file = dir
            thread3 = threading.Thread(target=delete_file,args=(f'{upload_folder_path}/{download_file}',))
            thread3.start()
            new_download_file_name = id
            if uploadOption!="folder":
                new_download_file_name = download_file.replace(id,'')#.replace(space_id,' ').replace(left_par_id,'(').replace(right_par_id,')')
            else:
                # folder_name = upload_folder_path.split('/')[]
                new_download_file_name = "Augmented Dataset"+".zip"
            ##print('download file:',download_file)
            return send_file(os.path.join(upload_folder_path, download_file), as_attachment=True,download_name=new_download_file_name)

@application.route('/check_finished/<id>', methods=['GET'])
def check_finished(id):
    ##print('FILE PATH BEING RETURNED:',dict_with_interactive_image_paths[id])
    return dict_with_interactive_image_paths[id] #returns an image path


@application.route('/get_all_paths_with_images/<folder_id>', methods=['GET'])
def get_all_paths_with_images(folder_id):
    parent_dir = os.path.join(upload_folder_path,folder_id)
    if not os.path.exists(parent_dir):
        for dir in os.listdir(upload_folder_path):
            if folder_id in dir:
                parent_dir = os.path.join(upload_folder_path,dir)
    image_directories = []
    for root, dirs, files in os.walk(parent_dir):
        if any(file.lower().endswith(('.png', '.jpg', '.jpeg', '.tiff', '.bmp')) for file in files):
            root = root.split("/")
            root = root[len(upload_folder_path.split('/'))+1:]
            root = '/'.join(root)
            image_directories.append(root)
    
    return jsonify(image_directories)


def check_if_folder_is_valid(folder_path): #checks if folder has valid classes
    folder_name = folder_path.split('/')[-1]
    not_classes = ['train','training','valid','test','validation','testing','val','__MACOSX',folder_name]
    train_dir_names = ['train','training']
    test_dir_names = ['test','testing']
    validation_dir_names = ['valid','validation']

    directories_with_images = find_image_directories(folder_path)
    class_paths = [i for i in directories_with_images if i.split('/')[-1].lower() not in not_classes]
    print('class names:',[i.split('/')[-1] for i in class_paths])     
    class_images = {}
    for path in class_paths:
        images_in_path = [i for i in os.listdir(path) if i.endswith(valid_image_extensions)]
        for i,v in enumerate(images_in_path):
            images_in_path[i] = os.path.join(path,v)
    
        class_images[path] = images_in_path
    #IMPORTANT: 'class_images' IS A DICTIONARY STORING CLASS PATHS AND THEIR CORRESPONDING IMAGES
    #IT WILL STORE UNLABELED IMAGES ASWELL


    # csv format:

    # filename, class1, class2, class3, etc.
    # 000001.jpg, 0, 1, 0
    # 000007.jpg, 0, 1, 0      
    # 000012.jpg, 0, 1, 0
    # 000013.jpg, 0, 1, 0
    class_images['csv_labeled_images'] = {} #csv labeled images is a dictionary containing the classes of all csv labeled images
    class_images['unlabeled_images'] = [] #unlabeled images stored here in this list (full paths)
    for dir_path in directories_with_images:
        dir_name = dir_path.split('/')[-1]
        if dir_name in not_classes and dir_name!='__MACOSX':
            filenames = os.listdir(dir_path)
            contains_csv = False
            for i in filenames:
                if i.endswith('.csv'):
                    contains_csv = True
                    break
            if contains_csv:
                for index,filename in enumerate(filenames):
                    if filename.endswith('.csv'):
                        csv_path = os.path.join(dir_path,filename)
                        csv_contents = pd.read_csv(csv_path)
                        classes = csv_contents.iloc[:,1:]
                        csv_filenames = csv_contents.iloc[:, 0]
                        image_names = [i for i in os.listdir(dir_path) if i.endswith(valid_image_extensions)]
                        class_info = find_classes(csv_path,image_names)
                        unlabeled_images = class_info[1]
                        for filepath in unlabeled_images:
                            class_images['unlabeled_images'].append(filepath)
                        class_images['csv_labeled_images'].update(class_info[0])
                        break
            else:
                #directory contains unlabeled images
                unlabeled_image_names = [i for i in os.listdir(dir_path) if i.endswith(valid_image_extensions)]
                unlabeled_image_paths = [os.path.join(dir_path,i) for i in unlabeled_image_names]
                for i in unlabeled_image_paths:
                    class_images['unlabeled_images'].append(i)

    #class images should also include unlabeled

    ###print('unlabeled:',class_images['unlabeled_images'])
    ###print('total unlabeled:',len(class_images['unlabeled_images']))
    ##print('total labeled with csv:',len(class_images['csv_labeled_images']))
    ###print('unlabeled:',len(class_images['unlabeled_images']))
    ##print('class images value:',class_images[list(class_images.keys())[0]])
    return class_images
    

#upload path, folderid
def make_interactive_images(path,id): #TODO:
    for absolute_path,dirs, files in os.walk(path):
        for filename in files:
            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.tiff', '.bmp')):
                img_path = os.path.join(absolute_path,filename)
                if(image_pathhs.get(id)==None):
                    e = img_path
                    image_pathhs[id] = '/'.join(e.split('/')[:-1])
                    # print("changed dict image paths")
                print('img path:',img_path.split('/')[:-1])
                if '__MACOSX' not in img_path:
                    #check if folder has images, if not, return none.
                    filename = img_path.split('/')[-1]
                    interactive_images_path = os.path.join(interactive_images_folder_path,id)
                    os.mkdir(interactive_images_path) #making a folder for the users interactive images
                    blur_path = os.path.join(interactive_images_path,'blur')
                    # rotate_90_path = os.path.join(interactive_images_path,'rotate_90')
                    counter_clockwise_path = os.path.join(interactive_images_path,'counter_clockwise')
                    clockwise_path = os.path.join(interactive_images_path,'clockwise')
                    upside_down_path = os.path.join(interactive_images_path,'upside_down')
                    crop_path = os.path.join(interactive_images_path,'crop')
                    grayscale_path = os.path.join(interactive_images_path,'grayscale')
                    rotate_path = os.path.join(interactive_images_path,'rotate')
                    flip_path = os.path.join(interactive_images_path,'flip')
                    os.mkdir(blur_path)
                    os.mkdir(counter_clockwise_path)
                    os.mkdir(clockwise_path)
                    os.mkdir(upside_down_path)
                    os.mkdir(crop_path)
                    os.mkdir(grayscale_path)
                    os.mkdir(rotate_path)
                    os.mkdir(flip_path)
                    for ext in valid_image_extensions:
                        if img_path.endswith(ext):
                            path_to_sample_image = os.path.join(interactive_images_path,'sample'+ext)
                            shutil.copyfile(img_path,path_to_sample_image)
                            break
                    
                    #First, we will generate the guassian blur images.
                    blur_decimal_range = np.arange(0.1, 25.1, 0.1) 
                    img_extension = '.jpg'
                    # ##print('generating blur images....')
                    for sigma in blur_decimal_range:
                        # ##print('sigma:',sigma)
                        for ext in valid_image_extensions:
                            if path_to_sample_image.endswith(ext):
                                img_extension=ext
                                output_path = os.path.join(blur_path,str(round(sigma,1)))+ext
                                apply_gaussian_blur(path_to_sample_image,round(sigma,1),output_path)
                                break
                    
                    
                    #Next, we will generate the rotate images.
                    # ##print('generating rotate images...')
                    rotate_range = [deg for deg in range(-45,46)]
                    for deg in rotate_range:
                        output_path = os.path.join(rotate_path,str(deg)+img_extension)
                        apply_rotate(path_to_sample_image,deg,output_path)
                        # ##print('deg:',deg)


                    #Next, we will generate the clockwise image, counter clockwise, and upside down image
                    
                    clockwise_output_path = os.path.join(clockwise_path,"clockwise"+img_extension)
                    counter_clockwise_output_path = os.path.join(counter_clockwise_path,"counter_clockwise"+img_extension)
                    upside_down_output_path = os.path.join(upside_down_path,"upside_down"+img_extension)

                    apply_clockwise(path_to_sample_image,clockwise_output_path)
                    apply_counter_clockwise(path_to_sample_image,counter_clockwise_output_path)
                    apply_upside_down(path_to_sample_image,upside_down_output_path)
                    

                    # next we will generate the cropped images.

                    for perc in range(1,100):
                        crop(path_to_sample_image,perc,os.path.join(crop_path,f'{perc}'+img_extension))
                        # ##print(f"crop image generated: {perc}%")


                    return os.path.join(interactive_images_folder_path,id,filename) #returning path to sample images

    # deleting folder since it has no images
    thread6 = threading.Thread(target=delete_dir,args=(path,))
    thread6.start()
    return 'none'



# def make_interactive_image_for_each_class(class_list,image_paths): #class_list is a list of classes for each image in image_paths


    


def find_dirs_of_filepath(filepath,id):
    
    filepath = filepath.split('/')
    filepath[0]+=id
    filepath = '/'.join(filepath)
    filepath = os.path.join(upload_folder_path, filepath)
    dir_names_and_filename = filepath.split('/')
    filename = dir_names_and_filename[-1]
    dir_names_and_filename.pop(-1)
    dir_names_and_filename.pop(0)
    for i,v in enumerate(dir_names_and_filename):
        dir_names_and_filename[i] = '/'+dir_names_and_filename[i] 
        directory_path = find_sum_of_strings(dir_names_and_filename[:i+1])
        if not os.path.exists(directory_path):
            os.mkdir(directory_path)
    file_path = find_sum_of_strings(dir_names_and_filename)+'/'+filename
    # ##print("file path:",file_path)
    return file_path




@application.route('/send_folder/<folder_id>/<last_upload>', methods=['post'])
def receive_folder_files(folder_id,last_upload):
    dict_with_interactive_image_paths[folder_id] = 'unfinished'
    files = request.files.getlist('file')
    total_files = len(files)
    file_saved_count = 0
    directory_to_upload = None
    
    for file in files:  
        filepath = find_dirs_of_filepath(file.filename,folder_id)
        if not os.path.exists(filepath): 
            file_saved_count+=1
            file.save(filepath)
            ###print(f'saved {file_saved_count} files out of {total_files}')
        else:
            ##print('file already exists')
            pass
    # #print('last upload:',last_upload)
    # finding folder path, and checking if it has images
    if folder_id not in os.listdir(upload_folder_path) and last_upload=='true':
        for folder_name in os.listdir(upload_folder_path):
            if folder_id in folder_name:
                directory_to_upload = os.path.join(upload_folder_path,folder_name)
                ##print("directory to upload:",directory_to_upload)
                img_path = make_interactive_images(directory_to_upload,folder_id)
                ##print("returned img path:",img_path)

                if img_path!='none':
                    class_data = check_if_folder_is_valid(directory_to_upload)
                    class_info_dict[folder_id] = class_data
                    for i in valid_image_extensions:
                        if img_path.endswith(i):
                            img_extension = i
                    dict_with_interactive_image_paths[folder_id] = img_extension
                else:
                    ##print('no images in dataset')
                    dict_with_interactive_image_paths[folder_id] = 'none'
                return dict_with_interactive_image_paths[folder_id]
    ###print('keys:',dict_with_interactive_image_paths.keys())
    return dict_with_interactive_image_paths[folder_id]


def delete_file(filename):
    time.sleep(.5)
    os.remove(filename)



@application.route("/uploadMultiple", methods=["POST"])
def upload_files():
    id = request.form['id']
    uploaded_folder_path =  os.path.join(application.config["UPLOAD_FOLDER"],id)
    # ##print('file 1:',request.files['file[1]'])
    """
    Endpoint to handle multiple file uploads via Dropzone.
    """
    ###print("STARTED UPLOADING MULTIPLE")    
    # print('file keys:',request.files.keys())
    # print('form keys:',request.form.keys())
    file_paths = []
    for i,fileKey in enumerate(request.files.keys()):
        file_path = os.path.join(uploaded_folder_path,request.form["file_path_"+str(i)])

        file = request.files[fileKey]

        name_of_dir_file_is_in = file_path.split('/')[-2]
        file_path_list = file_path.split('/')
        file_path_list.pop()
        
        file_path_list = ("/").join(file_path_list)

        path_to_dir_of_file = file_path_list
        if not os.path.exists(path_to_dir_of_file):
            os.makedirs(os.path.join(uploaded_folder_path,path_to_dir_of_file))
            file_paths.append(file_path)
            
        file.save(file_path)
            # saved_files.append(file.filename)


    if not request.files:
        return jsonify({"error": "No files part in the request"}), 400
    

    saved_files = []
    
    ###print("LAST UPLOAD:",request.form['last upload'])
    img_path = 'none'

    # for i,key in enumerate(request.files.keys()):
        
    #     file = request.files[key]
    #     if file.filename == "":
    #         continue  # Skip files without a name
    #     if not os.path.exists(uploaded_folder_path):
    #         os.makedirs(uploaded_folder_path)
    #     print("i:",i)
    #     print("num of file paths:",len(file_paths))
    #     file_path = os.path.join(uploaded_folder_path, secure_filename(file.filename))
    #     file.save(file_paths[i])
    #     saved_files.append(file.filename)
    # ##print('interactive images path exists:',os.path.exists(os.path.join(interactive_images_folder_path,id)))
    if (not os.path.exists(os.path.join(interactive_images_folder_path,id))) and (request.form['last upload']=='true'): 
        img_path = make_interactive_images(uploaded_folder_path,id)
        # ##print("img path:",img_path)
    if img_path!='none' and request.form['last upload']=='true':
        class_info = check_if_folder_is_valid(uploaded_folder_path)
        class_info_dict[id] = class_info
        # ##print("class info:",class_info_dict[id])
        for i in valid_image_extensions:
            if img_path.endswith(i):
                img_extension = i
        dict_with_interactive_image_paths[id] = img_extension #s
    elif img_path=='none' and request.form['last upload']=='true':
        dict_with_interactive_image_paths[id] = 'none'
        # ##print('RETURNING',dict_with_interactive_image_paths[id])
        return make_response(('Upload success', 200))
    ##print("SAVED FILES:",saved_files)
    return make_response(('Upload success', 200))

@application.route('/uploadZip', methods=['GET','POST'])
def upload():
 
   
    ##print("file keys:",list(request.files.keys())[0])
    ##print("form keys:",request.form.keys())
    file = request.files[list(request.files.keys())[0]]
    # file_id = request.form['id']
    file_id = request.form['id']
    # total_files = 
    dict_with_interactive_image_paths[file_id] = 'upload not finished'
    # file.filename = file.filename.replace(' ',space_id).replace('(',left_par_id).replace(')',right_par_id)
    # ##print("file name:",    file.filename)

    save_path = os.path.join(upload_folder_path, file_id+secure_filename(file.filename))

    current_chunk = int(request.form['dzchunkindex'])
    # If the file already exists it's ok if we are appending to it,
    # but not if it's new file that would overwrite the existing one
    if os.path.exists(save_path) and current_chunk == 0:
        # 400 and 500s will tell dsropzone that an error occurred and show an error
        return make_response(('File already exists', 400))

    try:
        with open(save_path, 'ab') as f:
            f.seek(int(request.form['dzchunkbyteoffset']))
            f.write(file.stream.read())
    except OSError:
        # log.exception will include the traceback so we can see what's wrong 
        log.exception('Could not write to file')
        return make_response(("Not sure why," " but we couldn't write the file to disk", 500))

    total_chunks = int(request.form['dztotalchunkcount'])
    ##print(f'current chunks to total chunks: {current_chunk}/{total_chunks}')
    if current_chunk + 1 == total_chunks:

        # This was the last chunk, the file should be complete and the size we expect
        if os.path.getsize(save_path) != int(request.form['dztotalfilesize']):
            log.error(f"File {file.filename} was completed, "
                      f"but has a size mismatch."
                      f"Was {os.path.getsize(save_path)} but we"
                      f" expected {request.form['dztotalfilesize']} ")
            return make_response(('Size mismatch', 500))
        else:
            ##print(f'File {file.filename} has been uploaded successfully')
            directory_to_extract_to = unzip(save_path)
            uploaded_directory = directory_to_extract_to
            path = uploaded_directory
            img_path = make_interactive_images(path,file_id)
            if img_path!='none':
                class_info = check_if_folder_is_valid(path)
                class_info_dict[file_id] = class_info
                ##print("class info:",class_info_dict[file_id])
                for i in valid_image_extensions:
                    if img_path.endswith(i):
                        img_extension = i
                dict_with_interactive_image_paths[file_id] = img_extension #s
            else:
                dict_with_interactive_image_paths[file_id] = 'none'
            #return img_path
            ##print('RETURNING',dict_with_interactive_image_paths[file_id])
            return make_response(('Upload success', 200))
            
            #unzip zip file here

    else:    
        log.debug(f'Chunk {current_chunk + 1} of {total_chunks}'
                  f'for file {file.filename} complete')
    
    return make_response(('Upload success', 200))
    #make_response(("Chunk upload successful", 200))#TODO: return image here 

def random_filename():
    rand_filename = str(uuid.uuid4())+'.zip'
    ##print(rand_filename)
    return rand_filename
def delete_zip_file(filename):
    os.remove(os.path.join(upload_folder_path,filename))

@application.route('/augment/<dataset_id>',methods=['POST','GET']) 
def augment(dataset_id):    
    ##print("class info keys:",class_info_dict.keys())
    if dataset_id not in class_info_dict:
        return make_response(('Dataset ID not found', 404))

    class_data = class_info_dict[dataset_id]
    augmentation_data = json.loads(request.form['aug_data'])
    directoriesToAugment = []
    vertically_flipped = False
    horizontally_flipped = False
    clockwiseRotated = False
    counterClockwiseRotated = False
    upsideDownRotated = False
    degreesRotated = 0
    min_crop_value = 0
    max_crop_value = 0
    blurValue = 0
    percentOutputtedImagesToGrayscale = 0 #number of images that will be grayscale formula: percentOutputtedImagesToGrayscale/100*totalImages*scaleValue
    scaleValue = 0
    resize_values = (0,0)
    gray_scale_pre_process = False
    flips = []
    rotates_90 = []

    folders = os.listdir(upload_folder_path)
    for folder_name in folders: # 
        if dataset_id in folder_name and '.zip' not in folder_name:
            full_dir_path = os.path.join(upload_folder_path,folder_name)
            output_file_path = os.path.join(upload_folder_path,folder_name)
            # folder to augment is full_dir_path
            #TODO: augment folder here
            print("augmentation data:",augmentation_data)
            #augmenting ONLY labled images
            images_to_augment = getAllLabeledImagePaths(dataset_id)

            for augmentString in augmentation_data: #augmentation data includes both augment data and pre-process data strings
                if "grayscalePreProcess" == augmentString:
                
                    print("grayscale pre-processing")
                    #making every labeled image grayscale
                    # #print("class data keys:",class_data.keys())
                    gray_scale_pre_process = True
                    # for image in images_to_augment:
                    #     image_path = image[0]
                    #     image_class = image[1]
                    #     img = cv2.imread(image_path)
                    #     gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                    #     cv2.imwrite(image_path,gray) 
                elif "flip" in augmentString:
                    print("flip augmentations:",augmentString.split("-")[1:])
                    augmentString = augmentString.split("-")
                    vertically_flipped = augmentString[1] == "true"
                    horizontally_flipped = augmentString[2] == "true"
                    if vertically_flipped:
                        flips.append(0)
                    if horizontally_flipped:
                        flips.append(1)
                elif "resize" in augmentString:
                    print("resize augmentations:",augmentString.split("-")[1:])
                    augmentString = augmentString.split("-")
                    resize_values = (int(augmentString[1]),int(augmentString[2]))
                elif "90_rotate" in augmentString:
                    print("90_rotate augmentations:",augmentString.split("-")[1:])
                    augmentString = augmentString.split("-")
                    clockwiseRotated = augmentString[1] == "true"
                    counterClockwiseRotated = augmentString[2] == "true"
                    upsideDownRotated = augmentString[3] == "true"
                    if clockwiseRotated:
                        rotates_90.append(0)
                    if counterClockwiseRotated:
                        rotates_90.append(1)
                    if upsideDownRotated:
                        rotates_90.append(2)

                elif "rotate" in augmentString:
                    print("rotate augmentations:",augmentString.split("-")[1:]) 
                    augmentString = augmentString.split("-")
                    degreesRotated = int(augmentString[1]) #degrees rotated ranges from -degreesRotated, to degreesRotated (ex. -5,5)
                elif "crop" in augmentString:
                    print("crop augmentations",augmentString.split("-")[1:])
                    augmentString = augmentString.split("-")
                    min_crop_value = float(augmentString[1])
                    max_crop_value = float(augmentString[2])
                elif "blur" in augmentString:
                    print("blur augmentations:",augmentString.split("-")[1:])
                    augmentString = augmentString.split("-")
                    blurValue = float(augmentString[1])
                elif "grayscale" in augmentString:
                    print("grayscale augmentations:",augmentString.split("-")[1:])  
                    augmentString = augmentString.split("-")
                    percentOutputtedImagesToGrayscale = float(augmentString[1])
                elif "scale" in augmentString:
                    print("scale augmentations:",augmentString.split("-")[1:])
                    augmentString = augmentString.split("-")
                    scaleValue = float(augmentString[1]) #augmented images generated for every original image
                elif "directories" in augmentString: #checking if augmentString contains directories
                    if "directories:all" not in augmentString:
                        directoriesToAugment = augmentString[12:].split(",")
                        print("directories to augment:",directoriesToAugment)
                    else:
                        global image_pathhs
                        print('keys:',image_pathhs.keys())
                        directoriesToAugment = [image_pathhs[dataset_id]] 
                        print("directories to augment:",directoriesToAugment[-1])
                
                
                
                    
            image_paths = []
            for dir in directoriesToAugment:
                path = os.path.join(upload_folder_path,dataset_id,dir)
                files = os.listdir(path)
                print("files:",files)
                random.shuffle(files)
                for file in files:
                    # print("file:",file)
                    #check if file is image
                    if file.lower().endswith(('.png', '.jpg', '.jpeg', '.tiff', '.bmp')):
                        file_path = os.path.join(path,file)
                        image_paths.append(file_path)

                        img = cv2.imread(file_path)
                        if gray_scale_pre_process:
                            img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                        if resize_values!=(0,0):
                            img = cv2.resize(img,resize_values)
                        cv2.imwrite(file_path,img)
                        for i in range(int(scaleValue)-1): # for every original image, generate scaleValue-1 augmented images
                            img = cv2.imread(file_path)
                            #handeling pre-process augmentations

                            randomfied_file_path = file_path.split("/")
                            randomfied_file_path[-1] =  str(uuid.uuid4())+randomfied_file_path[-1]
                            randomfied_file_path = '/'.join(randomfied_file_path)
                            image_paths.append(randomfied_file_path)


                            if len(flips)!=0:
                                flip_choice = random.choice(flips)
                                if flip_choice == 0:
                                    img = cv2.flip(img,0)
                                elif flip_choice == 1:
                                    img = cv2.flip(img,1)
                            if len(rotates_90)!=0:
                                rotate_choice = random.choice(rotates_90)
                                if rotate_choice == 0:
                                    img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
                                elif rotate_choice == 1:
                                    img = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
                                elif rotate_choice == 2:
                                    img = cv2.rotate(img, cv2.ROTATE_180)

                            if degreesRotated!=0:
                                #-degreesRotated, degreesRotated
                                # img = apply_rotate(img,degreesRotated)
                                # img = cv2.imread(file_path)
                                print("degrees rotated:",degreesRotated,"type:",type(degreesRotated))
                                if degreesRotated>0:
                                    degreesToAugment = random.randint(-1*int(degreesRotated),int(degreesRotated))
                                else:
                                    degreesToAugment = random.randint(int(degreesRotated),-1*int(degreesRotated))
                                print("degrees rotated:",degreesToAugment)
                                transform = A.Compose([
                                A.Rotate(always_apply=True, p=1.0, limit=(degreesToAugment, degreesToAugment), interpolation=0, border_mode=0, value=(0, 0, 0), mask_value=None, rotate_method='largest_box', crop_border=False),  # Rotate images by a random angle between -45 and 45 degrees
                                ])
                                augmented = transform(image=img)
                                img = augmented['image']
                                # cv2.imwrite(randomfied_file_path, rotated_image) #saving the augmented image with the dataset id appended to the end of the file name
                            if min_crop_value!=0 and max_crop_value!=0:
                                # print("image file path:",file_path)
                                # image = cv2.imread(file_path)
                                height = img.shape[0]
                                width = img.shape[1]
                                #generate random number for cropping
                                percentage = random.randint(min_crop_value,max_crop_value)
                                print("percentage generated:",percentage)
                                transform = A.Compose([
                                A.CenterCrop(height=round(height*((100-percentage)/100)), width=round(width*((100-percentage)/100)),p=1.0),
                                A.Resize(height=height, width=width)
                                ])
                                augmented = transform(image=img)
                                img = augmented['image']
                            
                                # cv2.imwrite(randomfied_file_path, cropped_image)
                            if blurValue!=0:
                                # image = Image.open(file_path)
                                print("blur value:",blurValue)
                                # generate a random blur value between 0.1 and blurValue, rounded to the nearest multiple of 0.1
                                blurValueToAugment = round(random.uniform(0.1, blurValue), 1)
                                print("blur value generated:",blurValue)
                                blur_radius = blurValueToAugment  # Adjust the radius as needed
                                 # Convert the OpenCV image (NumPy array) to a Pillow image
                                image = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
                                image = image.filter(ImageFilter.GaussianBlur(radius=blur_radius*2.3))
                                  # Convert the Pillow image back to an OpenCV image (NumPy array)
                                img = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
                            cv2.imwrite(randomfied_file_path, img) #saving the augmented image with the dataset id appended to the end of the file name
            if percentOutputtedImagesToGrayscale!=0:
                total_images = len(image_paths)
                imagesToGrayscale = int(float(percentOutputtedImagesToGrayscale)/100*len(image_paths))
                print("images to grayscale:",imagesToGrayscale)
                print("percentOutputtedImagesToGrayscale:",percentOutputtedImagesToGrayscale)
                for i in range(int(imagesToGrayscale)):
                    img = cv2.imread(image_paths[i])
                    img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                    cv2.imwrite(image_paths[i], img)

            shutil.make_archive(full_dir_path,'zip',output_file_path)
            thread4 = threading.Thread(target=delete_dir,args=(full_dir_path,))
            thread4.start()
            interactive_images_folder = os.path.join(interactive_images_folder_path,dataset_id)
            thread5 = threading.Thread(target=delete_dir,args=(interactive_images_folder,))
            thread5.start()
            break
    return 'augment succecfull' 



# @app.route('/',methods=['POST','GET']) 
# def start_page():
#     return render_template('Classification.html') #later on, use start page instead of classification.html

# @app.route('/',methods=['POST','GET'])
# def decline_service():
#     return render_template('index.html')


@application.route('/',methods=['POST','GET']) 
def Classification():
    return render_template('Classification.html')

@application.route('/Object_detection',methods=['POST','GET'])
def Object_detection():
    return render_template('Object_detection.html')
 
@application.route('/Segmentation',methods=['POST','GET'])
def Segmentation():
    return render_template('Segmentation.html')


    
@application.route('/get_all_images/<folder_id>/<aug>', methods=['GET'])
def get_all_preview_images(folder_id,aug):
    folder_path = os.path.join(interactive_images_folder_path,folder_id,aug)
    image_names = os.listdir(folder_path)
    
    # ##print("image names:",image_names)
    images = {}
    for img_name in image_names:
        image_path = os.path.join(folder_path,img_name)
        for ext in valid_image_extensions:
            if img_name.endswith(ext):
                blur_value = img_name.replace(ext,'')
                # ##print(f"{aug} value:",blur_value)
                break
        if os.path.exists(image_path):
            with open(image_path, "rb") as image_file:
                image_data = base64.b64encode(image_file.read()).decode('utf-8')
                images[blur_value] = image_data
        else:
            images[blur_value] = None

    return jsonify(images)

#changes a dataset's preview images based on pre-processing options
@application.route('/change_preview_images/<folder_id>/<pre_proccessing_option>')
def change_all_preview_images(folder_id,pre_proccessing_option):


    return 'fucked'

app = application
if __name__ == '__main__':
    application.run(host='0.0.0.0',port=5001)#debug=True #host='0.0.0.0', port=5000