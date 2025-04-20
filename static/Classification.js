

let originalImageWidth;
let originalImageHeight;

let totalChunks = 0;
let sentChunks = 0;
let sentFiles = 0;
let totalFiles = 0;
let sentBatches = 0;
let completedFiles = 0;
let batchSize = 20;
let augmentAllDirectories = false; //if there is a single directory only, augment all images in that directory
let uploadOption = "folder"; //default upload option


let image_ids = ['blur_sample_image', 'blur_normal_sample_image', 'rotate_normal_sample_image', 'rotate_sample_image', 'rotate_sample_image2', 'grayscale_sample_image', 'clockwise_sample_img', 'counter_clockwise_sample_img', 'upside_down_sample_img', 'vertical_flip_sample_img', 'horizontal_flip_sample_img', 'crop_sample_img', 'crop_sample_img2']

let folder_id = "id" + Math.random().toString(16).slice(2);
console.log("folder id:", folder_id)
let input_ids = ['Flip_check_box', '90° rotate_check_box', 'Crop_checkbox', 'grayscale_checkbox', 'Rotate_checkbox', 'blur_checkbox', 'Expansion', 'grayscale_preprocess', 'resize_preprocess', 'submit'];
console.log('JAVASCRIPT STARTED');
window.onload = function () {
    console.log("Page has loaded!");
    // Your code here

};
function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}
function setToDefault() {
    totalChunks = 0;
    sentChunks = 0;
    sentFiles = 0;
    totalFiles = 0;
    sentBatches = 0;
    completedFiles = 0;
    batchSize = 20;
};

Dropzone.options.dropper = {
    paramName: 'file',
    autoDiscover: true,
    timeout: 1.8e+6,//30 minute timeout
    // autoProcessQueue:true,
    // parallelUploads: 20,
    // uploadMultiple:true,
    init: function () {
        if (uploadOption == "folder") {
            this.options.autoProcessQueue = false;
            this.hiddenFileInput.setAttribute("webkitdirectory", true);
            this.options.chunking = false;
            this.options.url = "/uploadMultiple"
            this.options.forceChunking = false;
            this.options.uploadMultiple = true;
            this.acceptedFiles = null;
            this.maxFiles = null;
            this.options.parallelUploads = 20;
        }
        else {
            this.options.chunking = true;
            this.options.forceChunking = false;
            this.options.uploadMultiple = true;
            this.acceptedFiles = ".zip"
            this.hiddenFileInput.setAttribute("webkitdirectory", false);
            this.maxFiles = 1;
            this.options.autoProcessQueue = true;
            this.options.url = "/uploadZip"
            this.options.parallelUploads = null;

        }
        this.updateDropzoneOptions = function (newOptions) {
            for (let option in newOptions) {
                if (newOptions.hasOwnProperty(option)) {
                    this.options[option] = newOptions[option];
                }
            }
        }

        // Example of changing totalChunks from outside the Dropzone initialization

        // setToDefault();




        this.on("addedfile", function (file) {
            // console.log("filename:", file.name);
            totalFiles = this.files.length;


            if (uploadOption == "zip" && endsWith(file.name, '.zip')) {
                document.getElementById('augmentation').style.opacity = '25%';
                document.getElementById('Pre-Proccessing').style.opacity = '25%';
                this.options.autoProcessQueue = true;
            }
            if (uploadOption == "folder") {
                document.getElementById("submitFolder").style.display = "block";
            }
            // Calculate total chunks when a file is added
            totalChunks = Math.ceil(file.size / this.options.chunkSize);
            sentChunks = 0; // Reset counter for the new file
            // console.log(`Total chunks to send: ${totalChunks}`);
        });
        this.on("queuecomplete", async function () {
            if (uploadOption == "zip") {
                console.log("COMPLETED!")
                console.log('file id:', folder_id);
                let data1 = 'test';
                //wait for upload to finish, then enable inputs (augmentation options)

                while (data1 !== 'none' && !(data1.includes('.'))) {
                    console.log('checking if finished...')
                    await fetch('/check_finished/' + folder_id).then(response => {
                        const contentType = response.headers.get("content-type");
                        if (contentType && contentType.indexOf("application/json") == -1) {
                            return response.text().then(text => {
                                console.log('response:', text)
                                this.removeAllFiles(true);

                                this.options.chunking = true;
                                this.options.forceChunking = false;
                                this.options.uploadMultiple = false;
                                this.options.acceptedFiles = null;
                                this.options.maxFiles = null;
                                this.hiddenFileInput.setAttribute("webkitdirectory", true);
                                // this.options.autoProcessQueue = false;
                                data1 = text;
                            });
                        }
                    });
                }
                if (data1 === 'none') {
                    document.getElementById("uploading_images_text").style.display = "none";

                    console.log('no images found. invalid dataset')
                    document.getElementById("submitFolder").style.display = 'none';
                    this.removeAllFiles(true);


                    alert('dataset invalid or no images found')
                    folder_id = "id" + Math.random().toString(16).slice(2);

                }
                else {
                    document.getElementById("uploading_images_text").style.display = "none";
                    console.log('dataset uploaded successfully, valid')
                    sample_image_extension = data1;

                    enable_inputs();
                    console.log("enabling inputs on line 149")
                    document.getElementById('dropzone_buttons').style.display = 'none';
                    //document.getElementById('test_image').src = data1
                }
                setToDefault();
            }

        });
        this.on("sending", function (file, xhr, formData) {
            if (uploadOption == "zip") {
                document.getElementById("submitFolder").style.display = "none";
                formData.append('id', folder_id);
                document.getElementById("uploading_images_text").style.display = "block";
                sentChunks++;
                const remainingChunks = totalChunks - sentChunks;
                console.log(`Sent chunk ${sentChunks}/${totalChunks}. Remaining chunks: ${remainingChunks}`);
                if (remainingChunks == 0) {
                    console.log("0 remaining chunks")
                    document.getElementById("fetching_images_text").style.display = "block";
                    document.getElementById("uploading_images_text").style.display = "none";
                    // formData.append()
                }
                // Add parameters to be sent with every chunk request

                console.log("folder_id:", folder_id)
                console.log('sent chunk')
            }
        });
        this.on("sendingmultiple", function (files, xhr, formData) {
            if (uploadOption == "folder") {
                document.getElementById("uploading_images_text").style.display = "block";
                this.options.autoProcessQueue = true;
                sentBatches += 1;
                console.log(`Sending batch ${sentBatches}, Files: ${files.length}`);
                console.log("All files:", this.files);
                console.log("Queued files:", this.getQueuedFiles());
                formData.append('id', folder_id);


                // Append each file's relative path to the formData
                files.forEach(function (file, index) {
                    console.log("file path:", file.webkitRelativePath || file.name);
                    formData.append(`file_path_${index}`, file.webkitRelativePath || file.name);
                });


                // Check if the batch contains the last file(s)
                const isLastBatch = (sentBatches * batchSize >= totalFiles);
                console.log("last batch:", isLastBatch)
                if (isLastBatch == false) {
                    formData.append("last upload", 'false');
                }
                if (isLastBatch == true) {
                    formData.append("last upload", 'true');
                    document.getElementById("uploading_images_text").style.display = "none";
                    document.getElementById("fetching_images_text").style.display = "block";
                }

                if (isLastBatch) {
                    console.log("Last batch detected during sending.");
                }
            }
        });

        // Monitor when files finish uploading
        this.on("completemultiple", async function (files) {
            if (uploadOption == "folder") {
                completedFiles += files.length;
                console.log(`Batch upload complete. Total completed files: ${completedFiles}/${totalFiles}`);


                // Check if all files are done
                if (completedFiles === totalFiles) {
                    document.getElementById("submitFolder").style.display = "none";
                    document.getElementById("fetching_images_text").style.display = "none";
                    console.log("All files uploaded successfully.");
                    // Perform post-upload tasks here
                    document.getElementById("uploading_images_text").style.display = "none";
                    console.log("COMPLETED!")
                    console.log('file id:', folder_id);
                    let data1 = 'test';
                    //wait for upload to finish, then enable inputs (augmentation options)
                    while (data1 !== 'none' && !(data1.includes('.'))) {
                        console.log('checking if finished...')
                        await fetch('/check_finished/' + folder_id).then(response => {
                            const contentType = response.headers.get("content-type");
                            if (contentType && contentType.indexOf("application/json") == -1) {
                                return response.text().then(text => {
                                    console.log('response:', text)
                                    this.removeAllFiles(true);
                                    // this.options.autoProcessQueue = false;
                                    data1 = text;
                                });
                            }
                        });
                    }
                    if (data1 === 'none') {
                        document.getElementById("uploading_images_text").style.display = "none";
                        console.log('no images found. invalid dataset')
                        this.removeAllFiles(true);


                        this.options.chunking = true;
                        this.options.forceChunking = false;
                        this.options.uploadMultiple = false;
                        this.options.acceptedFiles = null;
                        this.options.maxFiles = null;
                        this.options.autoProcessQueue = false;
                        alert('dataset invalid or no images found')
                        folder_id = "id" + Math.random().toString(16).slice(2);

                    }
                    else {
                        this.hiddenFileInput.setAttribute("webkitdirectory", true);
                        document.getElementById("uploading_images_text").style.display = "none";
                        console.log('dataset uploaded successfully, valid')
                        sample_image_extension = data1;

                        enable_inputs();
                        console.log("enabling inputs on line 261")
                        document.getElementById('dropzone_buttons').style.display = 'none';
                        //document.getElementById('test_image').src = data1
                    }
                    setToDefault();
                }
            }
        });

    },


    maxFilesize: 100 * 1e+3, // MB (100 gb) 
    chunkSize: (1e+7), // bytes
    // acceptedFiles: '.zip',
    // maxFiles: NA,
    // parallelUploads: 1,
    maxfilesexceeded: function (file) {
        this.removeAllFiles();
        this.addFile(file);
    }
}
// // Example of calling updateDropzoneOptions from outside the Dropzone initialization
// function changeDropzoneOptions() {
//     var myDropzone = Dropzone.forElement("#dropper");
//     if (myDropzone) {
//         myDropzone.updateDropzoneOptions({ autoProcessQueue: false, parallelUploads: 10 })
//     }
// }
// const dropzoneElement = document.getElementById('dropper');
// new Dropzone(dropzoneElement, Dropzone.options.dropper);



class range_input_scripts {

    update_probabilities() {
        let sliders = ['Rotate_limit', 'blur_limit', 'grayscale_probability'];
        let i = 0
        while (i < sliders.length) {

            let slider = document.getElementById(sliders[i]);
            let show_slider = document.getElementById(`show_${sliders[i]}`)
            show_slider.innerText = slider.value
            if (sliders[i] === 'blur_limit') {
                // TODO: CHANGE SOURCE OF BLUR IMAGE HERE
                document.getElementById('blur_limit_caption').innerText = String(slider.value) + 'px'
            }
            if (sliders[i] === 'Rotate_limit') {
                document.getElementById('rotate_limit_caption').innerText = String(document.getElementById(sliders[i]).value) + '°'
                document.getElementById('rotate_limit_caption2').innerText = String(-1 * document.getElementById(sliders[i]).value) + '°'
            }

            i++
        }
    }
}
let range_input_methods = new range_input_scripts();

let default_upload_option = 'folder'
function chunkDictionary(dict, chunkSize) {
    // Convert object to array of key-value pairs
    const entries = Object.entries(dict);

    // Initialize an empty array to store the chunks
    const chunks = [];

    // Iterate over the entries array and group into chunks
    for (let i = 0; i < entries.length; i += chunkSize) {
        // Slice the entries array to get a chunk of size 'chunkSize'
        const chunk = entries.slice(i, i + chunkSize);

        // Convert the chunk back to an object
        const chunkObject = Object.fromEntries(chunk);

        // Push the chunk object to the chunks array
        chunks.push(chunkObject);
    }

    return chunks;
}


function grayscale_preview_images() {
    const images = document.querySelectorAll('img');
    if (document.getElementById('grayscale_preprocess').checked) {
        for (i = 0; i < images.length; i++) {
            let img = document.getElementById(images[i].id)
            img.style.filter = 'grayscale(100%)'
        }
    }
    else {
        for (i = 0; i < images.length; i++) {
            if (images[i].id !== "grayscale_sample_image") {
                document.getElementById(images[i].id).style.filter = 'grayscale(0%)'
            }
        }
    }
}
function send_dataset() {
    console.log('sending')
    document.getElementById("submitFolder").style.display = "none";
    // document.getElementById("zip").style.display = "none";
    // document.getElementById("folder").style.display = "none";
    // document.getElementById("files").style.display = "none";
    //TODO: only do this if there is a zip file in dropzone
    // Dropzone.options.autoProcessQueue = true;
    var myDropzone = Dropzone.forElement("#dropper");

    let count = myDropzone.files.length
    console.log("file count:", count)
    if (count > 0) {
        document.getElementById('augmentation').style.opacity = '25%';
        document.getElementById('Pre-Proccessing').style.opacity = '25%';
        // Set autoQueue to true
        // myDropzone.options.autoQueue = true;

        // Verify the setting
        console.log("autoQueue is now:", myDropzone.options.autoQueue);
        myDropzone.processQueue();
    }
}

// else {
//     if (document.getElementById('design').files.length > 0) {
//         console.log('sending folder')
//         document.getElementById('upload_progress').style.display = 'block';
//         document.getElementById('dropzone_buttons').style.display = 'none';
//         upload_folder();
//     }
// }

function check_if_image(data) {
    let valid_extensions = ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']
    for (i = 0; i < valid_extensions.length; i++) {
        if (data.includes(valid_extensions[i])) {
            return true;
        }
    }
    return false;
}
function resize_preview_images() {
    const items = document.getElementsByClassName("item");
    const images = document.querySelectorAll('img');
    if (document.getElementById('resize_preprocess').checked) {
        let selectedWidth = document.getElementById("input_width").value;
        let selectedHeight = document.getElementById("input_height").value;
        console.log("selected Width:", selectedWidth)
        console.log("selected Height:", selectedHeight)
        let aspectRatio = selectedWidth / selectedHeight;
        document.getElementById("resize_preprocess_pop_up").style.display = "block";
        let imageMaxHeight = originalImageHeight//document.getElementById("resize_sample_img").getBoundingClientRect().height
        let imageMaxWidth = originalImageWidth//document.getElementById("resize_sample_img").getBoundingClientRect().width
        for (i = 0; i < items.length; i++) {
            // images[i].style.filter = 'grayscale(100%)'
            items[i].style.aspectRatio = 1;
            // items[i].style.aspectRatio = aspectRatio;
            document.getElementById(images[i].id).style.aspectRatio = aspectRatio
            if ((selectedHeight > imageMaxHeight) || (selectedWidth > imageMaxWidth)) {

                if (aspectRatio > 1) {
                    console.log("aspect ratio greater than 1")
                    // document.getElementById(images[i].id).style.height = imageMaxHeight / aspectRatio + "px"
                    document.getElementById(images[i].id).style.width = imageMaxWidth + "px"
                }
                else if (aspectRatio < 1) {
                    console.log("aspect ratio less than 1")
                    // document.getElementById(images[i].id).style.height = imageMaxHeight + "px"
                    document.getElementById(images[i].id).style.width = imageMaxWidth * aspectRatio + "px"
                }
                if (aspectRatio == 1) {
                    console.log("aspect ratio is 1")
                    // document.getElementById(images[i].id).style.height = imageMaxHeight + "px"
                    document.getElementById(images[i].id).style.width = imageMaxWidth + "px"
                }
            }
            else {
                // document.getElementById(images[i].id).style.height = selectedHeight + "px"
                document.getElementById(images[i].id).style.width = selectedWidth + "px"
            }


        }

    }
    else {
        for (i = 0; i < items.length; i++) {
            // document.getElementById(image_ids[i]).style.width = 15*imageWidthToHeightRatio+"vw";
            // document.getElementById(image_ids[i]).style.height = 15*imageHeightToWidthRatio+"vw";
            // items[i].style.aspectRatio = originalImageWidth/originalImageHeight //making the width 30% of the UI
            // document.getElementById(images[i].id).style.aspectRatio = originalImageWidth/originalImageHeight

            document.getElementById(images[i].id).style.aspectRatio = originalImageWidth / originalImageHeight
            document.getElementById(images[i].id).style.width = originalImageWidth + "px"
            // document.getElementById(images[i].id).style.height = heightToWidthRatio*widthToHeightRatio*.3*width+"px" 

        }
        document.getElementById("resize_preprocess_pop_up").style.display = "none";
    }
    window.addEventListener("resize", resize_preview_images)
}
async function submit_everything() {
    alert("Augmenting uploaded dataset now...");


    document.getElementById("augmentation progress text").style.display = "block";
    document.getElementById("select_directories_header").style.display = "none";
    let aug_form_data = collect_aug_data();
    disable_inputs();
    let formData = new FormData();
    formData.append('aug_data', aug_form_data)
    //TODO: method here to call augmentation for specific dataset id and send over augmentation data
    //ex. augment_dataset(dataset_id,augmentation_form_data);
    //once dataset is finished augmenting
    await fetch('/augment/' + folder_id, { body: formData, method: 'post' }).then(response => {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json().then(data => {
                data1 = JSON.stringify(data);
            });
        } else {
            return response.text().then(text => {
                console.log('text:', text)
            });
        }
    });
    document.getElementById("augmentation progress text").style.display = "none";
    document.getElementById('download_tag').innerText = 'click here to download augmented dataset';
    document.getElementById('download_tag').href = '/download/' + folder_id + '/' + uploadOption;
}

async function change_all_preview_images(pre_proccessing_option) { //this function changes the preview images based on chosen pre-proccessing options
    let checkbox_id = pre_proccessing_option + '_preprocess';

    let checked = document.getElementById(checkbox_id).checked;
    if (checked) {
        await fetch('/change_preview_images/' + folder_id + '/' + pre_proccessing_option).then(response => {
            return response.text().then(text => {
                console.log('text:', text)
            });
        });
    }
    else {
        await fetch('/change_preview_images/' + folder_id + '/' + 'un_' + pre_proccessing_option).then(response => {
            return response.text().then(text => {
                console.log('text:', text)
            });
        });
    }
}




function close_download_tag() {
    // location.reload();
    let download_href = document.getElementById('download_tag');
    download_href.innerText = ''
    folder_id = "id" + Math.random().toString(16).slice(2);
    //download_href.href = ''
    document.getElementById('dropzone_buttons').style.display = 'block';
    document.getElementById('augmentation').style.opacity = '25%';
    document.getElementById('Pre-Proccessing').style.opacity = '25%';
    set_zip_or_folder_upload();

}

function set_zip_or_folder_upload() {
    setToDefault();

    folder_id = "id" + Math.random().toString(16).slice(2);
    console.log("folder id:", folder_id)
    // var dropzoneElement = document.getElementById('dropper');
    // dropzoneElement.removeAllFiles(true)
    Dropzone.forElement('#dropper').removeAllFiles(true);
    document.getElementById("submitFolder").style.display = "none";
    let zip_option = document.getElementById('zip');
    let folder_option = document.getElementById("folder");
    // resetDropZone();
    let files_option = document.getElementById("files");
    const myDropzone = Dropzone.instances.find(instance => instance.element.id === 'dropper');
    if (zip_option.checked) {
        uploadOption = "zip"
        // let myDropzone = Dropzone.forElement("#dropper"); // Assumes a single Dropzone instance

        console.log('doing zip uploads');
        default_upload_option = 'zip'
        document.getElementById('upload_buttons').style.display = 'block';

        Dropzone.forElement("#dropper").updateDropzoneOptions({ autoProcessQueue: true, parallelUploads: 20, chunking: true, forceChunking: true, uploadMultiple: true, acceptedFiles: ".zip", maxFiles: 1 });
        // Access the hidden file input
        const hiddenInput = myDropzone.hiddenFileInput;

        // Set the webkitdirectory attribute
        hiddenInput.removeAttribute("webkitdirectory");
        myDropzone.options.acceptedFiles = ".zip"
        myDropzone.hiddenFileInput.setAttribute("accept", ".zip");
        myDropzone.options.chunking = true;
        myDropzone.options.forceChunking = true;
        myDropzone.options.uploadMultiple = false;
        // this.acceptedFiles = ".zip"
        // this.hiddenFileInput.setAttribute("webkitdirectory", false);
        myDropzone.options.maxFiles = 1;
        myDropzone.options.parallelUploads = 20;
        myDropzone.options.autoProcessQueue = true;
        myDropzone.options.url = "/uploadZip"

        // Dropzone.options.dropper.acceptedFiles = '.zip'
        console.log("accepted files:", Dropzone.options.dropper.acceptedFiles)
    }
    if (folder_option.checked) {
        uploadOption = "folder"
        const dropzoneElement = Dropzone.instances[0]; // Assumes a single Dropzone instance
        console.log('doing folder uploads');
        default_upload_option = 'folder'
        Dropzone.forElement("#dropper").updateDropzoneOptions({ autoProcessQueue: false, parallelUploads: 20, chunking: false, forceChunking: false, uploadMultiple: true, acceptedFiles: null, maxFiles: null, url: "/uploadMultiple" });
        myDropzone.options.autoProcessQueue = false;
        // myDropzone.hiddenFileInput.setAttribute("webkitdirectory", true);
        myDropzone.options.chunking = false;
        myDropzone.options.url = "/uploadMultiple"
        myDropzone.options.forceChunking = false;
        myDropzone.options.uploadMultiple = true;
        myDropzone.acceptedFiles = null;
        myDropzone.maxFiles = null;
        myDropzone.options.parallelUploads = 20;


        // Access the hidden file input
        const hiddenInput = dropzoneElement.hiddenFileInput;

        // Set the webkitdirectory attribute
        hiddenInput.setAttribute("webkitdirectory", true);

    }
    if (files_option.checked) {
        uploadOption = "folder"
        let myDropzone = Dropzone.forElement("#dropper"); // Assumes a single Dropzone instance
        myDropzone.hiddenFileInput.removeAttribute("accept", ".zip");
        const dropzoneElement = Dropzone.instances[0]; // Assumes a single Dropzone instance
        myDropzone.options.autoProcessQueue = false;
        // myDropzone.hiddenFileInput.setAttribute("webkitdirectory", true);
        myDropzone.options.chunking = false;
        Dropzone.forElement("#dropper").updateDropzoneOptions({ autoProcessQueue: false, parallelUploads: 20, chunking: false, forceChunking: false, uploadMultiple: true, acceptedFiles: null, maxFiles: null, url: "/uploadMultiple" });
        myDropzone.options.parallelUploads = 20;
        myDropzone.options.url = "/uploadMultiple"
        myDropzone.options.forceChunking = false;
        myDropzone.options.uploadMultiple = true;
        myDropzone.acceptedFiles = null;
        myDropzone.maxFiles = null;
        myDropzone.options.parallelUploads = 20;
        // Access the hidden file input
        const hiddenInput = dropzoneElement.hiddenFileInput;
        // myDropzone.hiddenFileInput.setAttribute("", ".zip");
        // Set the webkitdirectory attribute
        hiddenInput.removeAttribute("webkitdirectory");
        Dropzone.options.dropper.acceptedFiles = null

    }
}

$("#slider-range").slider({
    range: true
});





async function upload_folder() {
    // document.getElementById('select_folder').style.display = 'none';
    let files = await document.getElementById('design').files
    let batch_size = 10;
    let chunks = chunkDictionary(files, batch_size)
    let num_chunks = chunks.length;
    responses = [];
    let last_upload = 'false';
    for (i = 0; i < chunks.length; i++) {
        console.log('i:', i, 'chunks length:', chunks.length);
        if ((i) == chunks.length - 1) {
            document.getElementById("uploading_images_text").style.display = "block";
        }
        last_upload = String((i + 1) === chunks.length);
        let formData = new FormData();
        let chunk = chunks[i];
        let starting_index = 0;
        if (i > 0) {
            starting_index = parseInt(Object.keys(chunks[i - 1])[Object.keys(chunks[i - 1]).length - 1]) + 1;
        }
        //console.log('starting index:',Object.keys(chunks[i-1])[Object.keys(chunk).length-1])
        let ending_index = Object.keys(chunk)[Object.keys(chunk).length - 1];
        if (!(starting_index === ending_index)) {
            for (g = starting_index; g <= ending_index; g++) {
                formData.append('file', chunk[g]);
            }
        }
        else {
            formData.append('file', chunk[starting_index]);
        }
        // let aug_data = collect_aug_data(); //collect aug data here
        // formData.append('augmentations', aug_data);
        console.log('waiting for chunk ' + String(i + 1) + ' out of ' + num_chunks);
        await fetch('/send_folder/' + folder_id + '/' + last_upload, { body: formData, method: 'post' }).then(response => {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                return response.json().then(data => {
                    let response_text_from_server = JSON.stringify(data);
                    console.log('response:json ', response_text_from_server);
                    responses.push(response_text_from_server)
                });
            } else {
                return response.text().then(response_text_from_server => {
                    console.log('response: text', response_text_from_server);
                    responses.push(response_text_from_server);
                });
            }
        });
        let progress = (i + 1) / num_chunks * 100;
        document.getElementById('dataset_upload_progress').value = progress;
        // if (response_text_from_server !== 'none') {
        //     console.log(response_text_from_server,'download')
        //     document.getElementById('test_image').src = response_text_from_server;
        // }

    }
    console.log('finished');
    document.getElementById("uploading_images_text").style.display = "none";
    let valid_return_count = 0;
    console.log('responses:', responses)
    for (i = 0; i < responses.length; i++) {
        let response = responses[i];
        if (response.includes('.')) {
            console.log('i:', i)
            valid_return_count += 1;
            document.getElementById('dataset_upload_progress').value = 100
            document.getElementById('dropzone_buttons').style.display = 'none';
            document.getElementById('design').value = null;
            sample_image_extension = response;
            enable_inputs();
            console.log("enabling inputs on line 695")
            break;
        }
    }
    if (valid_return_count === 0) {
        document.getElementById("uploading_images_text").style.display = "none";
        console.log('no images found')
        alert('no images found in dataset')
        document.getElementById('dropzone_buttons').style.display = 'block';
        document.getElementById('upload_progress').style.display = 'none';
        document.getElementById('upload_buttons').style.display = 'block';

        // document.getElementById('select_folder').style.display = 'block';
        set_zip_or_folder_upload();
    }
}



// Function to fetch directories with images
async function fetchImageDirectories(folderId) {
    try {
        // Make the GET request
        const response = await fetch(`/get_all_paths_with_images/${folderId}`);

        // Check if the response is successful
        if (!response.ok) {
            throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }

        // Parse the JSON response
        const imageDirectories = await response.json();

        // Log or process the directories
        console.log("Directories with images:", imageDirectories);
        if (imageDirectories.length === 0) {
            document.getElementById("select_directories_header").style.display = "none";
        }
        else {
            document.getElementById("select_directories_header").style.display = "block";
        }


        // Example: Render the directories as checkboxes
        const checkboxContainer = document.getElementById('image-directory-checkboxes');
        checkboxContainer.innerHTML = ''; // Clear existing checkboxes
        if (imageDirectories.length !== 1) {
            imageDirectories.forEach(directory => {
                // Create a label and checkbox
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = directory;
                checkbox.name = 'directories';
                checkbox.onclick = function () {
                    // Collect selected directories
                    const selectedDirectories = Array.from(document.querySelectorAll('input[name="directories"]:checked')).map(checkbox => checkbox.value);
                    //clear all selectedDirectories checkboxes here
                    console.log("Selected directories:", selectedDirectories);
                }

                // Add text to label and append checkbox
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(directory));
                label.style.display = 'block'; // Display each checkbox on a new line

                // Append to container
                checkboxContainer.appendChild(label);
            });
        }
        else {
            augmentAllDirectories = true;
            document.getElementById("select_directories_header").style.display = "none";
        }
    }
    catch (error) {
        console.error("Failed to fetch image directories:", error);
    }


}
// document.getElementById('directory-form').addEventListener('onchange', event => {
//     event.preventDefault(); // Prevent the default form submission

//     // Collect selected directories
//     const selectedDirectories = Array.from(
//         document.querySelectorAll('input[name="directories"]:checked')
//     ).map(checkbox => checkbox.value);

//     console.log("Selected directories:", selectedDirectories);

//     // Perform further actions with the selected directories, like sending them to the server
// });


function collect_aug_data() {
    aug_list = [];
    augs_checkboxes = ['Flip_check_box', 'blur_checkbox', "90° rotate_check_box", 'Crop_checkbox', 'Rotate_checkbox', 'blur_checkbox', 'resize_preprocess']
    let flip_checked = document.getElementById('Flip_check_box').checked;//check if blur is checked or not
    let rotation_90_checked = document.getElementById("90° rotate_check_box").checked;
    let crop_checked = document.getElementById('Crop_checkbox').checked;
    let rotate_checked = document.getElementById('Rotate_checkbox').checked;
    let blur_checked = document.getElementById('blur_checkbox').checked;
    let grayscale_checked = document.getElementById('grayscale_checkbox').checked;
    let preProcessGrayScaleChecked = document.getElementById("grayscale_preprocess").checked
    let resize_preprocess_checked = document.getElementById('resize_preprocess').checked;

    //send pre-process info first

    if (preProcessGrayScaleChecked) {
        aug_list.push('grayscalePreProcess');
    }
    if (flip_checked) {
        vertically_flipped = document.getElementById('vertical_flip').checked;

        horizontally_flipped = document.getElementById('horizontal_flip').checked;
        aug_list.push('flip' + "-" + vertically_flipped + "-" + horizontally_flipped) //items in order: vertically flipped, horizontally flipped, vertical prob, horizontal prob
    }
    if (rotation_90_checked) {
        let clockwiseRotated = document.getElementById("Clockwise").checked
        let counterClockwiseRotated = document.getElementById("Counter-Clockwise").checked
        let upsideDownRotated = document.getElementById("Upside Down").checked
        aug_list.push('90_rotate' + "-" + clockwiseRotated + "-" + counterClockwiseRotated + "-" + upsideDownRotated);

    }
    if (crop_checked) {
        console.log("crop checked")
        let min_crop_value = $("#slider-range").slider("values", 0)
        let max_crop_value = $("#slider-range").slider("values", 1)
        aug_list.push("crop" + "-" + min_crop_value + "-" + max_crop_value);
    }
    if (rotate_checked) {
        let degreesRotated = document.getElementById("Rotate_limit").value
        aug_list.push('rotate' + "-" + degreesRotated);
    }
    if (blur_checked) {
        let blurValue = document.getElementById("blur_limit").value
        aug_list.push('blur' + "-" + blurValue);
    }
    if (grayscale_checked) {
        let percentOutputtedImagesToGrayscale = document.getElementById("grayscale_probability").value
        aug_list.push('grayscale' + "-" + percentOutputtedImagesToGrayscale);
    }
    if (resize_preprocess_checked) {
        let selectedWidth = document.getElementById("input_width").value;
        let selectedHeight = document.getElementById("input_height").value;
        aug_list.push('resize' + "-" + selectedWidth + "-" + selectedHeight);
    }
    augmentation_scale_factor = document.getElementById('Expansion').value;
    augmentation_scale_factor = augmentation_scale_factor.substring(0, augmentation_scale_factor.length - 1);
    console.log("augmentation scale factor:", augmentation_scale_factor)
    aug_list.push('scale' + "-" + augmentation_scale_factor);
    if (!augmentAllDirectories) {
        const selectedDirectories = Array.from(document.querySelectorAll('input[name="directories"]:checked')).map(checkbox => checkbox.value);
        aug_list.push('directories:' + selectedDirectories); //directories user has chosen to augment
    }
    else{
        aug_list.push('directories:all');
    }
    document.getElementById('image-directory-checkboxes').innerHTML = "";
    document.getElementById('image-directory-checkboxes').innerText = "";
    //TODO: return form data instead of list
    return JSON.stringify(aug_list);
}
pop_up_ids = ['resize_preprocess_pop_up', 'rotate_pop_up', 'blur_pop_up', 'Flip_pop_up', '90_rotate_popup', 'crop_pop_up', 'grayscale_popup']
//blur_click_checkbox  flip_click_checkbox verticalflip_click_checkbox horizontalflip_click_checkbox rotate_90_click_checkbox crop_click_checkbox
class display_popups {
    rotate_click_checkbox() {
        let pop_up = document.getElementById('rotate_pop_up');
        let check_box = document.getElementById('Rotate_checkbox');
        if (check_box.checked == true) {
            pop_up.style.display = 'block';
            console.log('checked checkbox');
            // document.getElementById("Rotate").style = "display:flex;width:auto;align-items:center;"
        }
        if (check_box.checked == false) {
            pop_up.style.display = 'none';
            console.log('unchecked checkbox');
            document.getElementById("Rotate").style = ""
        }
    }
    blur_click_checkbox() {
        let pop_up = document.getElementById('blur_pop_up')
        let check_box = document.getElementById('blur_checkbox')
        if (check_box.checked == true) {
            pop_up.style.display = 'block';
            console.log('checked checkbox');
        }
        if (check_box.checked == false) {
            pop_up.style.display = 'none';

        }
    }
    flip_click_checkbox() {
        ('Flip pop up method CALLED')
        let flip_pop_up = document.getElementById('Flip_pop_up');
        if (document.getElementById('Flip_check_box').checked == true) {
            flip_pop_up.style.display = 'block';
            ('checked checkbox')
        }
        if (document.getElementById('Flip_check_box').checked == false) {
            flip_pop_up.style.display = 'none';
            ('unchecked checkbox')
        }

    }
    verticalflip_click_checkbox() {
        let vertical_flip_checkbox = document.getElementById('vertical_flip');
        let pop_up = document.getElementById('vertical_flip_popup')
        if (vertical_flip_checkbox.checked == true) {
            pop_up.style.display = 'block';
            console.log("checked box");
            // document.getElementById("vertical_flip_sample_img").style.display = "block";

        }
        else {
            pop_up.style.display = 'none';
            console.log("unchecked box");
        }
    }
    horizontalflip_click_checkbox() {
        let horizontal_flip_checkbox = document.getElementById('horizontal_flip');
        let pop_up = document.getElementById('horizontal_flip_popup')
        if (horizontal_flip_checkbox.checked == true) {
            pop_up.style.display = 'block';
            console.log("checked box");
            // document.getElementById("vertical_flip_sample_img")
        }
        else {
            pop_up.style.display = 'none';
            console.log("unchecked box");
        }
    }

    rotate_90_click_checkbox() {
        let rotate_90_box = document.getElementById('90° rotate_check_box')
        let rotate_90_pop_up = document.getElementById('90_rotate_popup')
        if (rotate_90_box.checked == true) {
            rotate_90_pop_up.style.display = 'block';
            ('checked checkbox')
        }
        if (rotate_90_box.checked == false) {
            rotate_90_pop_up.style.display = 'none';
        }
    }

    clockwise_click_checkbox() {
        let clockwise_box = document.getElementById('Clockwise')
        let clockwise_pop_up = document.getElementById('clockwise_popup')
        if (clockwise_box.checked == true) {
            clockwise_pop_up.style.display = 'block';
            ('checked checkbox')
        }
        if (clockwise_box.checked == false) {
            clockwise_pop_up.style.display = 'none';
        }
    }
    upside_down_click_checkbox() {
        let upside_down_box = document.getElementById('Upside Down')
        let upside_down_pop_up = document.getElementById('upside_down_popup')
        if (upside_down_box.checked == true) {
            upside_down_pop_up.style.display = 'block';
            ('checked checkbox')
        }
        if (upside_down_box.checked == false) {
            upside_down_pop_up.style.display = 'none';
        }
    }
    counter_clockwise_click_checkbox() {
        let counter_clockwise_box = document.getElementById('Counter-Clockwise')
        let counter_clockwise_pop_up = document.getElementById('counter-clockwise_popup')
        if (counter_clockwise_box.checked == true) {
            counter_clockwise_pop_up.style.display = 'block';
            ('checked checkbox')
        }
        if (counter_clockwise_box.checked == false) {
            counter_clockwise_pop_up.style.display = 'none';
        }
    }

    crop_click_checkbox() {
        let pop_up = document.getElementById('crop_pop_up')
        let check_box = document.getElementById('Crop_checkbox')
        if (check_box.checked == true) {
            pop_up.style.display = "block";
            // pop_up.style.cssText = "";
            // console.log('checked checkbox')
        }
        if (check_box.checked == false) {
            // pop_up.style.display = "position: absolute; left: -1000px";
            // pop_up.style.position='absolute';
            // pop_up.style.left='-1000px';
            pop_up.style.display = 'none';

        }
    }
    grayscale_click_checkbox() {
        let pop_up = document.getElementById('grayscale_popup')
        let check_box = document.getElementById('grayscale_checkbox')
        if (check_box.checked == true) {
            console.log(pop_up.style.display)
            pop_up.style.cssText = "";
        }
        if (check_box.checked == false) {
            // pop_up.style.display = "position: absolute; left: -1000px";
            console.log(pop_up.style.display)
            // pop_up.style.position='absolute';
            // pop_up.style.left='-1000px';
            pop_up.style.display = 'none';
        }
    }


}
let display_popups_methods = new display_popups();

function uncheck_all_checkboxes() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
    });
}




function reset_inputs() {
    // for (i = 0; i < input_ids.length; i++) {
    //     // input_ids[i].disabled = true;
    //     document.getElementById(input_ids[i]).checked = false;
    // }
    uncheck_all_checkboxes();
    for (i = 0; i < pop_up_ids.length; i++) {
        let popup_id = pop_up_ids[i];
        document.getElementById(popup_id).style.display = 'none';
    }
}

function disable_inputs() {
    reset_inputs();
    for (i = 0; i < input_ids.length; i++) {
        //children[i].disabled = true;
        let input = document.getElementById(input_ids[i]);
        input.disabled = true;
        document.getElementById('augmentation').style.opacity = '25%';
        document.getElementById('Pre-Proccessing').style.opacity = '25%';
        // document.getElementById('select_folder').style.display = 'block';
    }
}




async function enable_inputs() {

    // Example usage
    fetchImageDirectories(folder_id);

    document.getElementById("fetching_images_text").style.display = "block";

    console.log("enabling inputs")
    reset_inputs();
    document.getElementById('dataset_upload_progress').value = 0
    //upload_progress
 

    //getting slider ids
    let blur_slider = document.getElementById('blur_limit')
    let rotate_slider = document.getElementById('Rotate_limit')
    //instead of getting the crop slider id, we will get its two values:
    let min_crop_value = $("#slider-range").slider("values", 0)
    let max_crop_value = $("#slider-range").slider("values", 1)

    //setting the default source of all images before user touches sliders
    document.getElementById('blur_normal_sample_image').src = `/static/interactive_images_uploads/${folder_id}/sample${sample_image_extension}`
    document.getElementById('blur_sample_image').src = `/static/interactive_images_uploads/${folder_id}/blur/${String((Number(blur_slider.value)).toFixed(1))}${sample_image_extension}`
    document.getElementById('blur_limit_caption').innerText = String((Number(blur_slider.value)).toFixed(1)) + 'px'
    document.getElementById('show_blur_limit').innerText = String((Number(blur_slider.value)).toFixed(1))
    document.getElementById('grayscale_sample_image').src = `/static/interactive_images_uploads/${folder_id}/sample${sample_image_extension}`
    document.getElementById('rotate_normal_sample_image').src = `/static/interactive_images_uploads/${folder_id}/sample${sample_image_extension}`
    document.getElementById('rotate_sample_image').src = `/static/interactive_images_uploads/${folder_id}/rotate/${String((Number(rotate_slider.value)))}${sample_image_extension}`
    document.getElementById("counter_clockwise_sample_img").src = `/static/interactive_images_uploads/${folder_id}/counter_clockwise/counter_clockwise${sample_image_extension}`
    document.getElementById("clockwise_sample_img").src = `/static/interactive_images_uploads/${folder_id}/clockwise/clockwise${sample_image_extension}`
    document.getElementById("upside_down_sample_img").src = `/static/interactive_images_uploads/${folder_id}/upside_down/upside_down${sample_image_extension}`
    document.getElementById("vertical_flip_sample_img").src = `/static/interactive_images_uploads/${folder_id}/sample${sample_image_extension}`
    document.getElementById("horizontal_flip_sample_img").src = `/static/interactive_images_uploads/${folder_id}/sample${sample_image_extension}`
    // document.getElementById("horizontal_flip_sample_img").src = "{{ url_for('/static/interactive_images_uploads', filename=f'{sample}/{sample_image_extension}') }}"

    document.getElementById('rotate_sample_image2').src = `/static/interactive_images_uploads/${folder_id}/rotate/${String((Number(-rotate_slider.value)))}${sample_image_extension}`

    // crop sample img 1 will hold min crop %, crop sample img 2 will hold max crop %
    document.getElementById('crop_sample_img').src = `/static/interactive_images_uploads/${folder_id}/crop/${String((Number(1)))}${sample_image_extension}`
    document.getElementById('crop_sample_img2').src = `/static/interactive_images_uploads/${folder_id}/crop/${String((Number(28)))}${sample_image_extension}`
    document.getElementById("flip_normal_sample_img").src = `/static/interactive_images_uploads/${folder_id}/sample${sample_image_extension}`
    document.getElementById("90_rotate_normal_sample_img").src = `/static/interactive_images_uploads/${folder_id}/sample${sample_image_extension}`
    document.getElementById("resize_sample_img").src = `/static/interactive_images_uploads/${folder_id}/sample${sample_image_extension}`

    // making the dictionaries where the images will be stored
    const blur_images = {};
    const rotate_images = {};
    const crop_images = {};
    const class_images = {}; //this will store the images for each class
    const class_names_and_numbers = []; //this will store the names of each class with the number of images in each class

    //fetching all blur images
    await fetch(`/get_all_images/${folder_id}/blur`)
        .then(response => response.json())
        .then(data => {
            for (const [blur_value, image_data] of Object.entries(data)) {
                if (image_data) {
                    blur_images[blur_value] = `data:image/jpeg;base64,${image_data}`;
                }
            }
        })
        .catch(error => console.error('Error fetching images:', error));

    //fetching all rotate images
    await fetch(`/get_all_images/${folder_id}/rotate`)
        .then(response => response.json())
        .then(data => {
            for (const [rotate_value, image_data] of Object.entries(data)) {
                if (image_data) {
                    console.log("image data exists");
                    rotate_images[rotate_value] = `data:image/jpeg;base64,${image_data}`;
                }
            }
        })
        .catch(error => console.error('Error fetching images:', error));

    //fetching all crop images
    await fetch(`/get_all_images/${folder_id}/crop`)
        .then(response => response.json())
        .then(data => {
            for (const [crop_value, image_data] of Object.entries(data)) {
                if (image_data) {
                    crop_images[crop_value] = `data:image/jpeg;base64,${image_data}`;
                }
            }
        })
        .catch(error => console.error('Error fetching images:', error));

    // //fetching number of images in each class along with an image from each class with their names
    // await fetch(`/get_all_images/${folder_id}/classes`)
    //     .then(response => response.json())
    //     .then(data => {
    //         for (const [className, image_data] of Object.entries(data)) {
    //             if (image_data) {
    //                 class_images[className] = `data:image/jpeg;base64,${image_data}`;
    //             }
    //         }
    //     })
    //     .catch(error => console.error('Error fetching images:', error));

    //making it so that the blur slider shows preview images
    blur_slider.addEventListener('input', function () {
        const blur_value = this.value;
        const imgElement = document.getElementById('blur_sample_image');

        if (blur_images[blur_value]) {
            imgElement.src = blur_images[blur_value];
        }
    });
    //making it so that the rotate slider shows preview images
    rotate_slider.addEventListener('input', function () {
        const rotate_value = this.value;
        const imgElement1 = document.getElementById('rotate_sample_image');
        const imgElement2 = document.getElementById('rotate_sample_image2');
        if (rotate_images[rotate_value]) {
            imgElement1.src = rotate_images[rotate_value];
            imgElement2.src = rotate_images[-rotate_value];
        }
    });
    //making it so that the crop slider shows preview images
    $(function () {
        $("#slider-range").slider({
            range: true,
            min: 1,
            max: 99,
            values: [1, 28],
            slide: function (event, ui) {
                $("#amount").val(ui.values[0] + "%" + " - " + ui.values[1] + "%");
                console.log("Selected range:", ui.values[0], ui.values[1]);
                const imgElement1 = document.getElementById('crop_sample_img');
                const imgElement2 = document.getElementById('crop_sample_img2');
                if (crop_images[ui.values[0]]) {
                    imgElement1.src = crop_images[ui.values[0]]
                }
                if (crop_images[ui.values[1]]) {
                    imgElement2.src = crop_images[ui.values[1]]
                }

            }
        });
        $("#amount").val($("#slider-range").slider("values", 0) + "%" +
            " - " + $("#slider-range").slider("values", 1) + "%");
    });
    document.getElementById("blur_pop_up").style.display = "block"

    originalImageWidth = document.getElementById('blur_sample_image').getBoundingClientRect().width;
    originalImageHeight = document.getElementById('blur_sample_image').getBoundingClientRect().height;
    console.log("original image Width:", originalImageWidth)
    console.log("original image Height:", originalImageHeight)
    document.getElementById("blur_pop_up").style.display = "none"




    let aspectRatio = originalImageWidth / originalImageHeight
    const images = document.querySelectorAll('img');
    const items = document.getElementsByClassName("item");
    // document.getElementById("resize_preprocess_pop_up").style.display = "block";
    // for (i = 0; i < items.length; i++) {
    //     // images[i].style.filter = 'grayscale(100%)'
    //     // items[i].style.height = items[i].getBoundingClientRect().width;
    //     // items[i].style.aspectRatio = aspectRatio;
    //     // images[i].style.height = document.getElementById("input_height").value+"px"
    //     // images[i].style.height =  

    // }

    // let range_input_methods = new range_input_scripts();


    let data1;



    class copy_paste_code_scripts {
        copy_and_paste() {
            let copy_text = document.getElementById('code_block'); // id of the textbox
            copy_text.select();
            navigator.clipboard.writeText(copy_text.value);
            //document.execCommand("copy");
            alert('copy and pasted augmentation code');
        }



        // show_copy_and_paste_checkbox() {
        //     /*let aug_string = "import albumentations as A\n" + "import cv2\n" +
        //          "transform = A.Compose([\n" + "A.RandomCrop(width=256, height=256),\n" +
        //          "A.HorizontalFlip(p=0.5),\n" +
        //          "A.RandomBrightnessContrast(p=0.2)])\n";*/
        //     let check_box_element = document.getElementById('copy_paste_div');
        //     check_box_element.style.display = 'block';
        //     let text_box = document.getElementById('code_block');
        //     text_box.value = 'test';
        //     folder_id = "id" + Math.random().toString(16).slice(2);
        //     // Access Dropzone instance
        //     close_download_tag();
        //     var dropzone = Dropzone.forElement('#dropper');
        //     // dropzone.processQueue();
        //     //dropzone.removeAllFiles(true);
        //     // sending over
        // }
    }

    let copy_paste_code_methods = new copy_paste_code_scripts();
    document.getElementById("fetching_images_text").style.display = "none";

    document.getElementById('upload_progress').style.display = 'none';
    document.getElementById('dropzone_buttons').style.display = 'none';
    for (i = 0; i < input_ids.length; i++) {
        //children[i].disabled = true;
        document.getElementById(input_ids[i]).disabled = false;
        document.getElementById('augmentation').style.opacity = '100%';
        document.getElementById('Pre-Proccessing').style.opacity = '100%';
        document.getElementById('dropzone_buttons').style.display = 'none';
    }

}